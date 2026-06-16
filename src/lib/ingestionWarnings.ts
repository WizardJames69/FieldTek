// Frontend mirror of the ingestion-warning shape produced by the ingestion
// edge functions (supabase/functions/_shared/ingestionWarnings.ts) and stored
// in documents.ingestion_warnings (JSONB). Kept as a tiny standalone module so
// the document UI can render a truthful "Partial" state without importing Deno
// edge code.

export type IngestionWarningCode =
  | "EXTRACTION_TEXT_TRUNCATED"
  | "CHUNK_LIMIT_REACHED";

export interface IngestionWarning {
  code: IngestionWarningCode;
  message: string;
  limit: number;
}

const KNOWN_CODES: ReadonlySet<string> = new Set<IngestionWarningCode>([
  "EXTRACTION_TEXT_TRUNCATED",
  "CHUNK_LIMIT_REACHED",
]);

// User-facing summary for a partially-indexed document. The original file is
// always retained in storage, so this is phrased as "indexed", not "lost".
export const INGESTION_PARTIAL_SUMMARY =
  "Only part of this document was indexed. Sentinel may not be able to answer from sections that were skipped.";

/**
 * Coerce the raw JSONB value from documents.ingestion_warnings into a clean
 * IngestionWarning[]. Tolerates null/legacy rows and malformed/unknown entries.
 */
export function normalizeIngestionWarnings(raw: unknown): IngestionWarning[] {
  if (!Array.isArray(raw)) return [];
  const out: IngestionWarning[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.code !== "string" || !KNOWN_CODES.has(rec.code)) continue;
    out.push({
      code: rec.code as IngestionWarningCode,
      message: typeof rec.message === "string" ? rec.message : "",
      limit: typeof rec.limit === "number" ? rec.limit : 0,
    });
  }
  return out;
}
