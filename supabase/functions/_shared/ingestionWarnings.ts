// ============================================================
// Ingestion truncation/capping warnings (PR-1.1)
// ============================================================
// Pure, side-effect-free helpers shared by the ingestion edge functions
// (extract-document-text, generate-embeddings). When a document hits the
// extraction-length cap or the chunk-count cap, we persist a structured
// warning to documents.ingestion_warnings so the UI can show the document as
// "Partial" instead of silently presenting it as fully indexed.
//
// The original uploaded file is always retained in storage — these warnings
// describe what was *indexed for retrieval*, not data loss.

export type IngestionWarningCode =
  | "EXTRACTION_TEXT_TRUNCATED"
  | "CHUNK_LIMIT_REACHED";

const KNOWN_CODES: ReadonlySet<string> = new Set<IngestionWarningCode>([
  "EXTRACTION_TEXT_TRUNCATED",
  "CHUNK_LIMIT_REACHED",
]);

export interface IngestionWarning {
  code: IngestionWarningCode;
  message: string;
  limit: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Returns a warning when the extracted text exceeded the extraction-length cap
 * (and was therefore truncated), otherwise null. `extractedLength` is the
 * length BEFORE truncation.
 */
export function buildExtractionTruncationWarning(
  extractedLength: number,
  limit: number,
): IngestionWarning | null {
  if (extractedLength <= limit) return null;
  return {
    code: "EXTRACTION_TEXT_TRUNCATED",
    message:
      `Only the first ${formatNumber(limit)} characters were extracted from ` +
      `this document. Later pages may not be searchable.`,
    limit,
  };
}

/**
 * Returns a warning when the document produced more chunks than the chunk cap
 * (and was therefore capped), otherwise null. `rawChunkCount` is the count
 * BEFORE capping.
 */
export function buildChunkCapWarning(
  rawChunkCount: number,
  limit: number,
): IngestionWarning | null {
  if (rawChunkCount <= limit) return null;
  return {
    code: "CHUNK_LIMIT_REACHED",
    message:
      `Only the first ${formatNumber(limit)} chunks were indexed from this ` +
      `document. Later sections may not be searchable.`,
    limit,
  };
}

/**
 * Defensively coerce an unknown value (e.g. a JSONB column read back from the
 * database) into a clean IngestionWarning[]. Non-arrays, malformed entries, and
 * unknown codes are dropped. Used when merging freshly-computed warnings with
 * warnings already stored on the document (so a re-embed preserves the
 * extraction warning without resurrecting garbage).
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
