import { describe, it, expect } from 'vitest';

// The ingestion-warning builders live under supabase/functions/_shared (shared
// with the Deno edge functions) but are pure ES-module TypeScript, so Vitest
// imports them directly and `npm run test` / CI cover them.
import {
  buildExtractionTruncationWarning,
  buildChunkCapWarning,
  normalizeIngestionWarnings,
} from '../../../supabase/functions/_shared/ingestionWarnings';

// PR-1.1: when ingestion hits the extraction-length cap (100k chars) or the
// chunk-count cap (500), the document must carry a structured warning so it is
// never silently presented as fully indexed.

describe('buildExtractionTruncationWarning', () => {
  it('emits EXTRACTION_TEXT_TRUNCATED when over the cap, naming the limit', () => {
    const w = buildExtractionTruncationWarning(100001, 100000);
    expect(w).not.toBeNull();
    expect(w!.code).toBe('EXTRACTION_TEXT_TRUNCATED');
    expect(w!.limit).toBe(100000);
    expect(w!.message).toContain('100,000');
  });

  it('emits nothing exactly at the cap (no off-by-one)', () => {
    expect(buildExtractionTruncationWarning(100000, 100000)).toBeNull();
  });

  it('emits nothing under the cap', () => {
    expect(buildExtractionTruncationWarning(5000, 100000)).toBeNull();
  });
});

describe('buildChunkCapWarning', () => {
  it('emits CHUNK_LIMIT_REACHED when over the cap, naming the limit', () => {
    const w = buildChunkCapWarning(742, 500);
    expect(w).not.toBeNull();
    expect(w!.code).toBe('CHUNK_LIMIT_REACHED');
    expect(w!.limit).toBe(500);
    expect(w!.message).toContain('500');
  });

  it('emits nothing exactly at the cap (no off-by-one)', () => {
    expect(buildChunkCapWarning(500, 500)).toBeNull();
  });

  it('emits nothing under the cap', () => {
    expect(buildChunkCapWarning(120, 500)).toBeNull();
  });
});

describe('normalizeIngestionWarnings', () => {
  it('passes through valid warnings', () => {
    const input = [
      { code: 'EXTRACTION_TEXT_TRUNCATED', message: 'a', limit: 100000 },
      { code: 'CHUNK_LIMIT_REACHED', message: 'b', limit: 500 },
    ];
    expect(normalizeIngestionWarnings(input)).toHaveLength(2);
  });

  it('treats null/undefined/non-array as empty', () => {
    expect(normalizeIngestionWarnings(null)).toEqual([]);
    expect(normalizeIngestionWarnings(undefined)).toEqual([]);
    expect(normalizeIngestionWarnings('nope')).toEqual([]);
    expect(normalizeIngestionWarnings({})).toEqual([]);
  });

  it('drops entries with an unknown or missing code', () => {
    const input = [
      { code: 'EXTRACTION_TEXT_TRUNCATED', message: 'a', limit: 100000 },
      { code: 'SOMETHING_ELSE', message: 'x', limit: 1 },
      { message: 'no code', limit: 1 },
      null,
      42,
    ];
    const out = normalizeIngestionWarnings(input);
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('EXTRACTION_TEXT_TRUNCATED');
  });
});
