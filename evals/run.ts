// ============================================================
// Sentinel AI eval harness — runner (PR-2.1)
// ============================================================
// Asks the benchmark question set against the deployed field-assistant, reads
// each answer's ai_audit_logs row for retrieval/judge signals, scores every
// case, and writes a JSON report.
//
//   npx tsx evals/run.ts --self-test     # offline; no backend, no OpenAI cost
//   npx tsx evals/run.ts                 # LIVE: hits field-assistant (OpenAI $)
//   npx tsx evals/run.ts --limit 3       # first N cases
//   npx tsx evals/run.ts --out report.json
//
// LIVE runs require .env.test (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
// SUPABASE_SERVICE_ROLE_KEY, E2E admin creds) and call OpenAI via the deployed
// backend — so they cost money. Seeding is free (pre-computed embeddings).
// Thresholds / pass-fail gating and cost controls arrive in PR-2.2 / PR-2.3.

import { config } from "dotenv";
config({ path: ".env.test" });

import * as fs from "fs";
import * as path from "path";

import { createAIClient, type AIAPIClient } from "../e2e/helpers/ai-api-client";
import { waitForAuditLog } from "../e2e/helpers/audit-log-helpers";
import { getAdminClient } from "../e2e/helpers/supabase-admin";
import { TEST_USERS } from "../e2e/helpers/test-data";

import { BENCHMARK_CASES } from "./cases";
import { scoreCase, aggregate } from "./scoring";
import { interpretResponse, extractCitedDocNames } from "./observe";
import { ensureCorpusSeeded, resolveTenantId } from "./seed";
import type {
  EvalCase,
  EvalCaseResult,
  EvalObservation,
  EvalReport,
} from "./types";

interface Args {
  selfTest: boolean;
  limit?: number;
  out?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--self-test") args.selfTest = true;
    else if (a === "--limit") args.limit = Number(argv[++i]);
    else if (a === "--out") args.out = argv[++i];
  }
  return args;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// ── Live execution ──────────────────────────────────────────

async function fetchChunkContext(
  chunkIds: string[],
): Promise<{ texts: string[]; docNames: string[] }> {
  if (chunkIds.length === 0) return { texts: [], docNames: [] };
  const admin = getAdminClient();
  const { data: chunks } = await admin
    .from("document_chunks")
    .select("chunk_text, document_id")
    .in("id", chunkIds);
  const texts = (chunks ?? [])
    .map((r) => r.chunk_text as string)
    .filter((t): t is string => Boolean(t));
  const docIds = [
    ...new Set(
      (chunks ?? [])
        .map((r) => r.document_id as string)
        .filter((d): d is string => Boolean(d)),
    ),
  ];
  let docNames: string[] = [];
  if (docIds.length > 0) {
    const { data: docs } = await admin.from("documents").select("name").in("id", docIds);
    docNames = (docs ?? [])
      .map((d) => d.name as string)
      .filter((n): n is string => Boolean(n));
  }
  return { texts, docNames };
}

async function observeCase(
  client: AIAPIClient,
  adminToken: string,
  tenantId: string,
  c: EvalCase,
): Promise<EvalObservation> {
  const res = await client.sendChatMessage({
    messages: [{ role: "user", content: c.question }],
    context: c.context,
    authToken: adminToken,
  });

  const interp = interpretResponse(res);
  const citedDocNames = extractCitedDocNames(res.metadata?.sources);

  let retrievedChunkCount = 0;
  let retrievedDocNames: string[] = [];
  let retrievedChunkTexts: string[] = [];
  let hadCitations = interp.answered && citedDocNames.length > 0;
  let judgeGrounded: boolean | null = null;
  let judgeVerdict: string | null = null;

  // Retrieval/judge detail comes from the audit log. The abstain-gate JSON
  // response does not carry a correlation_id, so for those cases we score on
  // the response signals alone (must_abstain only needs `abstained`).
  if (res.correlationId) {
    try {
      const log = await waitForAuditLog(tenantId, res.correlationId, 20000);
      retrievedChunkCount = num(log.semantic_search_count);
      if (typeof log.had_citations === "boolean") hadCitations = log.had_citations;
      if (typeof log.judge_grounded === "boolean") judgeGrounded = log.judge_grounded;
      if (typeof log.judge_verdict === "string") judgeVerdict = log.judge_verdict;
      const chunkIds = Array.isArray(log.chunk_ids) ? (log.chunk_ids as string[]) : [];
      const ctx = await fetchChunkContext(chunkIds);
      retrievedChunkTexts = ctx.texts;
      retrievedDocNames = ctx.docNames;
    } catch (e) {
      console.warn(`[eval]   audit log unavailable for ${c.id}: ${(e as Error).message}`);
    }
  }

  return {
    caseId: c.id,
    answered: interp.answered,
    abstained: interp.abstained,
    answerText: interp.answerText,
    retrievedChunkCount,
    retrievedDocNames,
    retrievedChunkTexts,
    citedDocNames,
    hadCitations,
    judgeGrounded,
    judgeVerdict,
  };
}

// ── Report assembly ─────────────────────────────────────────

function buildReport(
  label: string,
  results: EvalCaseResult[],
  nowIso: string,
): EvalReport {
  return {
    generatedAtIso: nowIso,
    label,
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    metrics: aggregate(results),
    cases: results,
  };
}

function pct(v: number | null): string {
  return v === null ? "n/a" : `${(v * 100).toFixed(0)}%`;
}

function printSummary(report: EvalReport, file?: string): void {
  const m = report.metrics;
  console.log(`\n=== Sentinel eval — ${report.label} ===`);
  console.log(`cases:              ${report.total}`);
  console.log(`passed:             ${report.passed}/${report.total}`);
  console.log(`retrieval accuracy: ${pct(m.retrievalAccuracy)}`);
  console.log(`citation support:   ${pct(m.citationSupport)}`);
  console.log(`fact coverage:      ${pct(m.factCoverage)}`);
  console.log(`abstain rate:       ${pct(m.abstainRate)}`);
  console.log(`hallucination rate: ${pct(m.hallucinationRate)}`);
  for (const r of report.cases) {
    console.log(`  ${r.passed ? "✓" : "✗"} ${r.caseId} [${r.type}]`);
  }
  if (file) console.log(`\nreport written: ${file}`);
}

function writeReport(report: EvalReport, outArg?: string): string {
  const dir = path.join(process.cwd(), "evals", "reports");
  fs.mkdirSync(dir, { recursive: true });
  const file =
    outArg ?? path.join(dir, `report-${report.generatedAtIso.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  return file;
}

// ── Offline self-test ───────────────────────────────────────
// Proves the harness scores + reports correctly on canned observations, with
// no backend and no OpenAI cost. Run in CI/dev as a smoke before any live run.

function syntheticObservation(caseId: string, kind: "good" | "miss" | "abstain"): EvalObservation {
  const base: EvalObservation = {
    caseId,
    answered: false,
    abstained: false,
    answerText: "",
    retrievedChunkCount: 0,
    retrievedDocNames: [],
    retrievedChunkTexts: [],
    citedDocNames: [],
    hadCitations: false,
    judgeGrounded: null,
    judgeVerdict: null,
  };
  if (kind === "good") {
    return {
      ...base,
      answered: true,
      answerText:
        "Verify the thermostat is off, turn on the main disconnect, switch to cool, and wait. [Source: Carrier 24ACC636 Installation Manual p.3]",
      retrievedChunkCount: 2,
      retrievedDocNames: ["Carrier 24ACC636 Installation Manual"],
      retrievedChunkTexts: ["Startup procedure for the Carrier 24ACC636: verify the thermostat is set to off..."],
      citedDocNames: ["Carrier 24ACC636 Installation Manual"],
      hadCitations: true,
      judgeGrounded: true,
      judgeVerdict: "pass",
    };
  }
  if (kind === "abstain") {
    return { ...base, abstained: true, answerText: "I cannot find this information in the uploaded documents." };
  }
  return { ...base, answered: true, answerText: "Unsure.", retrievedDocNames: ["Unrelated Doc"], judgeGrounded: false };
}

function runSelfTest(nowIso: string): void {
  const byId = (id: string) => BENCHMARK_CASES.find((c) => c.id === id)!;
  const fixtures: Array<{ c: EvalCase; obs: EvalObservation }> = [
    { c: byId("EV-M-001"), obs: syntheticObservation("EV-M-001", "good") },
    { c: byId("EV-M-004"), obs: syntheticObservation("EV-M-004", "miss") },
    { c: byId("EV-A-003"), obs: syntheticObservation("EV-A-003", "abstain") },
  ];
  const results = fixtures.map(({ c, obs }) => scoreCase(c, obs));
  const report = buildReport("self-test (offline)", results, nowIso);
  printSummary(report);
  // Sanity: the canned good/abstain cases pass and the miss fails.
  const ok =
    results.find((r) => r.caseId === "EV-M-001")?.passed === true &&
    results.find((r) => r.caseId === "EV-M-004")?.passed === false &&
    results.find((r) => r.caseId === "EV-A-003")?.passed === true;
  if (!ok) {
    console.error("\n[eval] SELF-TEST FAILED: scoring did not match expectations");
    process.exit(1);
  }
  console.log("\n[eval] self-test OK (offline, no cost)");
}

// ── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const nowIso = new Date().toISOString();

  if (args.selfTest) {
    runSelfTest(nowIso);
    return;
  }

  const cases = args.limit ? BENCHMARK_CASES.slice(0, args.limit) : BENCHMARK_CASES;
  const client = createAIClient(); // throws if env missing
  const tenantId = await resolveTenantId();
  const seedInfo = await ensureCorpusSeeded(tenantId);
  console.log(
    `[eval] tenant=${tenantId} corpus_chunks=${seedInfo.chunkCount} (seeded_now=${seedInfo.seeded})`,
  );
  const adminToken = await client.getAuthToken(
    TEST_USERS.admin.email,
    TEST_USERS.admin.password,
  );

  const results: EvalCaseResult[] = [];
  for (const c of cases) {
    const obs = await observeCase(client, adminToken, tenantId, c);
    const r = scoreCase(c, obs);
    results.push(r);
    console.log(
      `[eval] ${r.passed ? "PASS" : "FAIL"} ${c.id} (answered=${obs.answered} abstained=${obs.abstained} retrieved=${obs.retrievedChunkCount})`,
    );
  }

  const report = buildReport("hvac-first-benchmark", results, nowIso);
  const file = writeReport(report, args.out);
  printSummary(report, file);
}

main().catch((e) => {
  console.error("[eval] run failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
