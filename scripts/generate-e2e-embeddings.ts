/**
 * Generate realistic, deterministic embeddings for the E2E AI seed corpus.
 *
 * Why this exists
 * ───────────────
 * The field-assistant edge function embeds each user query at request time
 * with OpenAI `text-embedding-3-small`, then abstains (returns a structured
 * "insufficient_retrieval_coverage" JSON instead of a streamed answer) when
 * fewer than MIN_RELEVANT_CHUNKS relevant chunks are retrieved. The E2E seed
 * chunks must therefore carry embeddings from the SAME model, or grounded
 * queries score marginally and the pipeline abstains — which is exactly what
 * turned the chromium-ai-pipeline suite red.
 *
 * This script embeds every chunk text in TEST_DOCUMENTS once and writes a
 * checked-in fixture (e2e/fixtures/chunk-embeddings.json) keyed by a SHA-256
 * of the chunk text. Test-time seeding reads that fixture, so CI stays fully
 * offline and deterministic — no live OpenAI calls happen during tests.
 *
 * Run (one-off, only when chunk texts change)
 * ───────────────────────────────────────────
 *   OPENAI_API_KEY=sk-… npx tsx scripts/generate-e2e-embeddings.ts
 *
 * The key is read from the environment (or a gitignored .env / .env.test) and
 * is NEVER written to the fixture. Use a non-production key.
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { TEST_DOCUMENTS } from '../e2e/helpers/ai-test-data';
import { LESSON_CHUNKS } from '../evals/lessonCorpus';

// Pick up a key from a gitignored .env / .env.test if present (never committed).
config({ path: '.env' });
config({ path: '.env.test' });

const MODEL = 'text-embedding-3-small';
const DIMENSION = 1536;
const OUT_PATH = join('e2e', 'fixtures', 'chunk-embeddings.json');

// Required only when there are NEW chunk texts to embed (checked in main()).
const apiKey = process.env.OPENAI_API_KEY;

/** Stable fixture key for a chunk text — must match e2e/helpers/ai-seed-helpers.ts. */
function keyForText(text: string): string {
  return createHash('sha256').update(text.trim()).digest('hex');
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODEL, input: text }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI embeddings request failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const vec = json.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== DIMENSION) {
    throw new Error(`Unexpected embedding shape: length=${vec?.length ?? 'none'}`);
  }
  // Round to 8 decimals → smaller, stable-diff fixture (cosine impact < 1e-7).
  return vec.map((v) => Math.round(v * 1e8) / 1e8);
}

/** Load the existing fixture's embeddings map (or empty if absent/unreadable). */
function loadExisting(): Record<string, number[]> {
  if (!existsSync(OUT_PATH)) return {};
  try {
    const parsed = JSON.parse(readFileSync(OUT_PATH, 'utf-8')) as {
      embeddings?: Record<string, number[]>;
    };
    return parsed.embeddings ?? {};
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  // Collect unique chunk texts (dedupe identical texts) across the shared E2E
  // corpus AND the PR-3c approved-lesson fixture.
  const texts: string[] = [];
  const seen = new Set<string>();
  const collect = (text: string) => {
    const key = keyForText(text);
    if (!seen.has(key)) {
      seen.add(key);
      texts.push(text);
    }
  };
  for (const doc of TEST_DOCUMENTS) for (const chunk of doc.chunks) collect(chunk.text);
  for (const chunk of LESSON_CHUNKS) collect(chunk.text);

  // Incremental + stable: reuse already-embedded vectors verbatim and only call
  // OpenAI for texts whose key is missing (or wrong-length). This keeps the
  // committed diff to just the new/changed entries and avoids re-embedding the
  // existing corpus. Rebuilding from the CURRENT text set also prunes orphans.
  const existing = loadExisting();
  const isUsable = (v: unknown): v is number[] => Array.isArray(v) && v.length === DIMENSION;
  const missing = texts.filter((t) => !isUsable(existing[keyForText(t)]));

  console.log(
    `Chunk texts: ${texts.length} total | reusing ${texts.length - missing.length} ` +
      `existing | missing ${missing.length}.`,
  );
  for (const t of missing) {
    console.log(`  • MISSING ${keyForText(t).slice(0, 12)}  ${t.slice(0, 56)}…`);
  }

  if (missing.length === 0) {
    console.log('All chunk texts already have embeddings — no OpenAI call needed.');
  } else if (!apiKey) {
    console.error(
      `\n✗ ${missing.length} chunk text(s) need embedding but OPENAI_API_KEY is not set.\n` +
        '  Provide a non-production OpenAI key (env var, or a gitignored .env) and re-run:\n' +
        '    OPENAI_API_KEY=sk-… npx tsx scripts/generate-e2e-embeddings.ts',
    );
    process.exit(1);
  }

  const embeddings: Record<string, number[]> = {};
  let embeddedCount = 0;
  for (const text of texts) {
    const key = keyForText(text);
    if (isUsable(existing[key])) {
      embeddings[key] = existing[key];
      continue;
    }
    embeddings[key] = await embed(text);
    embeddedCount += 1;
    console.log(`  ✓ embedded ${key.slice(0, 12)}  ${text.slice(0, 56)}…`);
  }

  // Sort keys lexically so the committed fixture has stable diffs.
  const sorted: Record<string, number[]> = {};
  for (const key of Object.keys(embeddings).sort()) sorted[key] = embeddings[key];

  const fixture = {
    _comment:
      'AUTO-GENERATED by scripts/generate-e2e-embeddings.ts — do not edit by hand. ' +
      'Keys are sha256(chunk_text.trim()); values are text-embedding-3-small vectors. ' +
      'Regenerate after changing any chunk text in e2e/helpers/ai-test-data.ts or ' +
      'evals/lessonCorpus.ts.',
    model: MODEL,
    dimension: DIMENSION,
    count: Object.keys(sorted).length,
    embeddings: sorted,
  };

  writeFileSync(OUT_PATH, JSON.stringify(fixture, null, 2) + '\n');
  console.log(
    `\nWrote ${OUT_PATH} (${fixture.count} embeddings, model ${MODEL}; ` +
      `${embeddedCount} newly embedded, ${fixture.count - embeddedCount} reused).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
