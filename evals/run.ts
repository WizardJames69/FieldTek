// ============================================================
// Sentinel AI eval harness — runner (PR-2.1 + PR-2.2 gating/cost)
// ============================================================
// Asks the benchmark question set against the deployed field-assistant, reads
// each answer's ai_audit_logs row for retrieval/judge signals, scores every
// case, writes a JSON report, and gates the result against thresholds.
//
//   npx tsx evals/run.ts --self-test          # offline scoring smoke (no cost)
//   npx tsx evals/run.ts --report r.json --check   # offline: gate a saved report
//   npx tsx evals/run.ts                       # LIVE: hits field-assistant (OpenAI $)
//   npx tsx evals/run.ts --limit 3            # first N cases
//   npx tsx evals/run.ts --max-tokens 50000   # stop the live run at a token budget
//   npx tsx evals/run.ts --check              # LIVE + exit non-zero if below thresholds
//   npx tsx evals/run.ts --report r.json --baseline prev.json --check  # + no-regression
//   npx tsx evals/run.ts --thresholds t.json --check  # override default floors
//   npx tsx evals/run.ts --out report.json
//
// --check enforces the gate (non-zero exit on failure) so it can back a CI
// ship-gate (PR-2.3). --report / --self-test are offline and free; only a bare
// or --check LIVE run calls OpenAI.
//
// LIVE runs require .env.test (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
// SUPABASE_SERVICE_ROLE_KEY, E2E admin creds) and call OpenAI via the deployed
// backend — so they cost money. Seeding is free (pre-computed embeddings).

import { config } from "dotenv";
config({ path: ".env.test" });

import * as fs from "fs";
import * as path from "path";

import { createAIClient, type AIAPIClient } from "../e2e/helpers/ai-api-client";
import { waitForAuditLog } from "../e2e/helpers/audit-log-helpers";
import { getAdminClient } from "../e2e/helpers/supabase-admin";
import { EVAL_ADMIN_EMAIL, EVAL_ADMIN_PASSWORD } from "./evalIdentity";

import { BENCHMARK_CASES } from "./cases";
import { LESSON_DOCUMENT_NAME, LESSON_CHUNKS } from "./lessonCorpus";
import { scoreCase, aggregate } from "./scoring";
import { buildCaseReport } from "./report";
import {
  interpretResponse,
  extractCitedDocNames,
  extractCitedDocNamesFromText,
  mergeCitedDocNames,
} from "./observe";
import { ensureCorpusSeeded, resolveTenantId } from "./seed";
import {
  checkThresholds,
  DEFAULT_THRESHOLDS,
  type EvalThresholds,
  type ThresholdCheckResult,
} from "./thresholds";
import { createCostTracker, sumTokens } from "./cost";
import type {
  EvalCase,
  EvalCaseReport,
  EvalMetrics,
  EvalObservation,
  EvalReport,
} from "./types";

interface Args {
  selfTest: boolean;
  /** Enforce thresholds: print the gate verdict and exit non-zero on failure. */
  check: boolean;
  limit?: number;
  out?: string;
  /** Offline: load + gate this saved report JSON instead of running live. */
  report?: string;
  /** Saved report JSON whose metrics are the no-regression baseline. */
  baseline?: string;
  /** JSON file overriding the default thresholds (partial merge). */
  thresholds?: string;
  /** Live-run token budget; stop before starting a case once exhausted. */
  maxTokens?: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { selfTest: false, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--self-test") args.selfTest = true;
    else if (a === "--check") args.check = true;
    else if (a === "--limit") args.limit = Number(argv[++i]);
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--report") args.report = argv[++i];
    else if (a === "--baseline") args.baseline = argv[++i];
    else if (a === "--thresholds") args.thresholds = argv[++i];
    else if (a === "--max-tokens") args.maxTokens = Number(argv[++i]);
  }
  return args;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** A blank observation (answered=false), optionally carrying a captured error. */
function emptyObservation(caseId: string, error: string | null = null): EvalObservation {
  return {
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
    error,
  };
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
): Promise<{ obs: EvalObservation; tokensUsed: number }> {
  const res = await client.sendChatMessage({
    messages: [{ role: "user", content: c.question }],
    context: c.context,
    authToken: adminToken,
  });

  const interp = interpretResponse(res);
  // Cited docs from BOTH the streamed metadata.sources AND the answer text's
  // [Source: …] markers. The server EMPTIES metadata.sources when validation
  // fails, so reading the text recovers a real citation the metadata dropped —
  // without masking loss (a corruption-mangled marker simply won't parse).
  const citedDocNamesFromMetadata = extractCitedDocNames(res.metadata?.sources);
  const citedDocNamesFromText = extractCitedDocNamesFromText(interp.answerText);
  const citedDocNames = mergeCitedDocNames(citedDocNamesFromMetadata, citedDocNamesFromText);

  const metaDegraded =
    typeof res.metadata?.degraded === "boolean" ? (res.metadata.degraded as boolean) : null;
  const metaDegradedReason =
    typeof res.metadata?.degraded_reason === "string"
      ? (res.metadata.degraded_reason as string)
      : null;

  let retrievedChunkCount = 0;
  let retrievedDocNames: string[] = [];
  let retrievedChunkTexts: string[] = [];
  let hadCitations = interp.answered && citedDocNames.length > 0;
  let judgeGrounded: boolean | null = null;
  let judgeVerdict: string | null = null;
  let citationDensity: number | null = null;
  let abstainFlag: boolean | null = null;
  let enforcementRulesTriggered: string[] | null = null;
  let similarityScores: number[] | null = null;
  let auditLogId: string | null = null;
  let tokensUsed = 0;

  // Retrieval/judge detail comes from the audit log. The abstain-gate JSON
  // response does not carry a correlation_id, so for those cases we score on
  // the response signals alone (must_abstain only needs `abstained`).
  if (res.correlationId) {
    try {
      const log = await waitForAuditLog(tenantId, res.correlationId, 20000);
      retrievedChunkCount = num(log.semantic_search_count);
      // had_citations from the audit is the server's view; OR in the client
      // text-parse so a client-visible citation isn't lost if the server view
      // was stripped/corrupted (never masks a truly missing citation).
      if (typeof log.had_citations === "boolean") {
        hadCitations = log.had_citations || citedDocNamesFromText.length > 0;
      }
      if (typeof log.judge_grounded === "boolean") judgeGrounded = log.judge_grounded;
      if (typeof log.judge_verdict === "string") judgeVerdict = log.judge_verdict;
      if (typeof log.citation_density === "number") citationDensity = log.citation_density;
      if (typeof log.abstain_flag === "boolean") abstainFlag = log.abstain_flag;
      if (Array.isArray(log.enforcement_rules_triggered)) {
        enforcementRulesTriggered = log.enforcement_rules_triggered as string[];
      }
      if (Array.isArray(log.similarity_scores)) {
        similarityScores = log.similarity_scores as number[];
      }
      if (typeof log.id === "string") auditLogId = log.id;
      tokensUsed = sumTokens(
        log.token_count_prompt as number,
        log.token_count_response as number,
      );
      const chunkIds = Array.isArray(log.chunk_ids) ? (log.chunk_ids as string[]) : [];
      const ctx = await fetchChunkContext(chunkIds);
      retrievedChunkTexts = ctx.texts;
      retrievedDocNames = ctx.docNames;
    } catch (e) {
      console.warn(`[eval]   audit log unavailable for ${c.id}: ${(e as Error).message}`);
    }
  }

  return {
    obs: {
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
      citedDocNamesFromMetadata,
      citedDocNamesFromText,
      citationDensity,
      abstainFlag,
      degraded: metaDegraded,
      degradedReason: metaDegradedReason,
      enforcementRulesTriggered,
      similarityScores,
      auditLogId,
      correlationId: res.correlationId ?? null,
      error: null,
    },
    tokensUsed,
  };
}

// ── Report assembly ─────────────────────────────────────────

function buildReport(
  label: string,
  results: EvalCaseReport[],
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

// ── Threshold gate (PR-2.2) ─────────────────────────────────
// Turns a report's metrics into a pass/fail verdict against floors (+ optional
// no-regression check vs a baseline). With --check, a failing gate sets a
// non-zero exit code so this can back a CI ship-gate later (PR-2.3).

function loadReport(file: string): EvalReport {
  return JSON.parse(fs.readFileSync(file, "utf8")) as EvalReport;
}

function loadThresholds(file?: string): EvalThresholds {
  if (!file) return DEFAULT_THRESHOLDS;
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<EvalThresholds>;
  return { ...DEFAULT_THRESHOLDS, ...raw };
}

function loadBaselineMetrics(file?: string): EvalMetrics | null {
  return file ? loadReport(file).metrics : null;
}

function printThresholdVerdict(result: ThresholdCheckResult): void {
  console.log(`\n--- threshold gate: ${result.passed ? "PASS" : "FAIL"} ---`);
  for (const v of result.violations) console.log(`  ✗ [${v.kind}] ${v.message}`);
}

/**
 * Evaluate a report against thresholds. `forceShow` prints the verdict even
 * without --check (used after live/report runs); --check additionally enforces
 * the gate via a non-zero exit code.
 */
function gate(
  report: EvalReport,
  thresholds: EvalThresholds,
  baseline: EvalMetrics | null,
  args: Args,
  forceShow: boolean,
): void {
  if (!forceShow && !args.check) return;
  const result = checkThresholds(report.metrics, thresholds, baseline);
  printThresholdVerdict(result);
  if (args.check && !result.passed) {
    console.error("[eval] FAIL: metrics did not meet thresholds (--check)");
    process.exitCode = 1;
  }
}

// ── Offline self-test ───────────────────────────────────────
// Proves the harness scores + reports correctly on canned observations, with
// no backend and no OpenAI cost. Run in CI/dev as a smoke before any live run.

function syntheticObservation(
  caseId: string,
  kind: "good" | "miss" | "abstain" | "lessonGood",
): EvalObservation {
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
  // An approved lesson retrieved + cited as the ONLY supporting source.
  if (kind === "lessonGood") {
    return {
      ...base,
      answered: true,
      answerText:
        `Put the unit in standby, then press and hold MODE and DOWN together for 10 seconds ` +
        `to clear the E5 firmware fault. [Source: ${LESSON_DOCUMENT_NAME}]`,
      retrievedChunkCount: LESSON_CHUNKS.length,
      retrievedDocNames: [LESSON_DOCUMENT_NAME],
      retrievedChunkTexts: LESSON_CHUNKS.map((c) => c.text),
      citedDocNames: [LESSON_DOCUMENT_NAME],
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

function runSelfTest(nowIso: string): EvalReport {
  const byId = (id: string) => BENCHMARK_CASES.find((c) => c.id === id)!;
  const fixtures: Array<{ c: EvalCase; obs: EvalObservation }> = [
    { c: byId("EV-M-001"), obs: syntheticObservation("EV-M-001", "good") },
    { c: byId("EV-M-004"), obs: syntheticObservation("EV-M-004", "miss") },
    { c: byId("EV-A-003"), obs: syntheticObservation("EV-A-003", "abstain") },
    // PR-3c: an approved lesson retrieved + cited as the sole supporting source.
    { c: byId("EV-LESSON-001"), obs: syntheticObservation("EV-LESSON-001", "lessonGood") },
  ];
  const results = fixtures.map(({ c, obs }) => buildCaseReport(c, obs, scoreCase(c, obs)));
  const report = buildReport("self-test (offline)", results, nowIso);
  printSummary(report);

  // The onlyDocumentNames sole-source gate must REJECT a foreign retrieved source.
  const lessonCase = byId("EV-LESSON-001");
  const foreignObs = syntheticObservation("EV-LESSON-001", "lessonGood");
  foreignObs.retrievedDocNames = [...foreignObs.retrievedDocNames, "Carrier 24ACC636 Installation Manual"];
  const soleSourceEnforced = scoreCase(lessonCase, foreignObs).passed === false;

  // Sanity: the canned good/lesson/abstain cases pass, the miss fails, and the
  // sole-source gate rejects a foreign source.
  const ok =
    results.find((r) => r.caseId === "EV-M-001")?.passed === true &&
    results.find((r) => r.caseId === "EV-M-004")?.passed === false &&
    results.find((r) => r.caseId === "EV-A-003")?.passed === true &&
    results.find((r) => r.caseId === "EV-LESSON-001")?.passed === true &&
    soleSourceEnforced;
  if (!ok) {
    console.error("\n[eval] SELF-TEST FAILED: scoring did not match expectations");
    process.exit(1);
  }
  console.log("\n[eval] self-test OK (offline, no cost)");
  return report;
}

// ── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const nowIso = new Date().toISOString();
  const thresholds = loadThresholds(args.thresholds);
  const baseline = loadBaselineMetrics(args.baseline);

  // ── Offline: gate a previously-saved report (no backend, no OpenAI cost) ──
  if (args.report) {
    const report = loadReport(args.report);
    printSummary(report);
    gate(report, thresholds, baseline, args, true);
    return;
  }

  // ── Offline: scoring self-test on canned observations (no cost) ──
  if (args.selfTest) {
    const report = runSelfTest(nowIso);
    gate(report, thresholds, baseline, args, false);
    return;
  }

  // ── Live: ask the deployed assistant — this calls OpenAI (costs money) ──
  const cases = args.limit ? BENCHMARK_CASES.slice(0, args.limit) : BENCHMARK_CASES;
  const client = createAIClient(); // throws if env missing
  const tenantId = await resolveTenantId();
  const seedInfo = await ensureCorpusSeeded(tenantId);
  console.log(
    `[eval] tenant=${tenantId} corpus_chunks=${seedInfo.chunkCount} (seeded_now=${seedInfo.seeded})`,
  );
  const adminToken = await client.getAuthToken(
    EVAL_ADMIN_EMAIL,
    EVAL_ADMIN_PASSWORD,
  );

  const tracker = createCostTracker(args.maxTokens ?? null);
  const results: EvalCaseReport[] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    if (!tracker.hasRoom()) {
      console.warn(
        `[eval] token budget (${args.maxTokens}) reached after ${i} case(s) — ` +
          `skipping ${cases.length - i} remaining (spent=${tracker.spent()})`,
      );
      break;
    }
    // Capture per-case errors into the report instead of aborting the whole run,
    // so one bad case still produces a diagnosable row (error redacted by report.ts).
    let obs: EvalObservation;
    let tokensUsed = 0;
    try {
      const observed = await observeCase(client, adminToken, tenantId, c);
      obs = observed.obs;
      tokensUsed = observed.tokensUsed;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[eval] ${c.id} errored: ${msg}`);
      obs = emptyObservation(c.id, msg);
    }
    const r = scoreCase(c, obs);
    results.push(buildCaseReport(c, obs, r));
    tracker.record(tokensUsed);
    console.log(
      `[eval] ${r.passed ? "PASS" : "FAIL"} ${c.id} (answered=${obs.answered} ` +
        `abstained=${obs.abstained} retrieved=${obs.retrievedChunkCount} ` +
        `tokens=${tokensUsed} spent=${tracker.spent()})`,
    );
  }

  const report = buildReport("hvac-first-benchmark", results, nowIso);
  const file = writeReport(report, args.out);
  printSummary(report, file);
  gate(report, thresholds, baseline, args, true);
}

main().catch((e) => {
  console.error("[eval] run failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
