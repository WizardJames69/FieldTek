// ============================================================
// Field Assistant — Degraded-Answer Classification
// ============================================================
// Side-effect-free (no top-level I/O or server startup) so it can be imported
// directly by index.test.ts for real unit coverage — the same pattern as
// constants.ts. index.ts imports classifyDegradedAnswer to decide whether a
// served answer is retrieval-grounded or a degraded full-document fallback.

/**
 * Why an answer is degraded — i.e. served from the full-document fallback
 * rather than targeted semantic retrieval.
 *
 * - `retrieval_unavailable`: the tenant has indexed (embedded) documents but
 *   retrieval never ran for this request (query-embedding failure, retrieval
 *   adapter error, or a skipped short query). The fallback answer is built from
 *   raw document text, not from targeted chunks.
 * - `indexing_incomplete`: document content exists but nothing is embedded yet,
 *   so retrieval cannot run. The answer comes from the full-document fallback
 *   while indexing finishes.
 */
export type DegradedReason = "retrieval_unavailable" | "indexing_incomplete";

export interface AnswerGroundingState {
  /** Documents with extracted_text and extraction_status = "completed". */
  docsWithContentCount: number;
  /** Documents with embedding_status = "completed" (i.e. retrievable). */
  docsWithEmbeddingsCount: number;
  /** True only when the retrieval adapter actually executed and returned. */
  retrievalRan: boolean;
  /** Number of semantic chunks used to build the grounding context. */
  semanticSearchResultsCount: number;
}

/**
 * Classify whether an answer that is about to be served — the orchestrator has
 * already passed the insufficient-coverage abstain gate — is a degraded
 * full-document fallback, and if so why.
 *
 * Returns `null` for a normal, retrieval-grounded answer (or when there is no
 * document content to ground against, i.e. general-knowledge onboarding mode);
 * a {@link DegradedReason} otherwise. Pure — no side effects.
 */
export function classifyDegradedAnswer(state: AnswerGroundingState): DegradedReason | null {
  // Real semantic chunks were used → the answer is retrieval-grounded.
  if (state.semanticSearchResultsCount > 0) return null;

  // No document content exists at all → the model is answering from general
  // knowledge (expected onboarding state), not a degraded retrieval fallback.
  if (state.docsWithContentCount <= 0) return null;

  // Document content exists but nothing is embedded yet → retrieval cannot run;
  // the answer comes from the full-document fallback while indexing completes.
  if (state.docsWithEmbeddingsCount <= 0) return "indexing_incomplete";

  // Indexed (embedded) docs exist but no chunks were used. If retrieval never
  // ran (embedding-generation failure, adapter error, or skipped short query),
  // the full-document fallback answer is NOT retrieval-grounded.
  if (!state.retrievalRan) return "retrieval_unavailable";

  // Indexed docs + retrieval ran + zero chunks is owned by the upstream
  // insufficient-coverage abstain gate (it returns a refusal before we reach
  // the answer path), so this is not a degraded fallback answer.
  return null;
}

/**
 * Why the orchestrator abstains before calling the answer model.
 *
 * - `retrieval_unavailable`: the tenant has indexed (embedded) documents but
 *   retrieval never ran for this request (query-embedding failure, retrieval
 *   adapter error, a skipped short query, or semantic search disabled). There
 *   are no grounded chunks to answer from, so the only available answer would
 *   be an ungrounded full-document fallback.
 * - `insufficient_retrieval_coverage`: retrieval ran but produced fewer
 *   qualifying chunks than the minimum required to answer confidently.
 */
export type RetrievalAbstainReason =
  | "retrieval_unavailable"
  | "insufficient_retrieval_coverage";

export interface RetrievalAbstainState {
  /** Documents with embedding_status = "completed" (i.e. retrievable). */
  docsWithEmbeddingsCount: number;
  /** True only when the retrieval adapter actually executed and returned. */
  retrievalRan: boolean;
  /** Number of qualifying semantic chunks retrieval produced. */
  semanticSearchResultsCount: number;
  /** Minimum qualifying chunks required to answer (MIN_RELEVANT_CHUNKS). */
  minRelevantChunks: number;
  /**
   * True when exactly one chunk was retrieved AND it qualified as a strong
   * single-chunk answer (see {@link isStrongSingleChunkAnswer}). Optional so
   * existing callers/tests keep their exact behavior — absent means false.
   */
  strongSingleChunk?: boolean;
  /**
   * True when exactly one chunk remains AND it is a lexically rescued chunk
   * that qualified for a single-chunk answer (see
   * {@link isLexicalSingleChunkAnswer}). Optional so existing callers/tests
   * keep their exact behavior — absent means false.
   */
  lexicalSingleChunk?: boolean;
}

/**
 * Inputs for the strong-single-chunk answer decision. All floors are passed
 * in (from constants.ts) so the rule itself stays pure and testable.
 */
export interface SingleChunkAnswerState {
  /** Number of qualifying semantic chunks retrieval produced. */
  semanticSearchResultsCount: number;
  /** Reported similarity of the single retrieved chunk. */
  similarity: number;
  /** Character length of the single retrieved chunk's text. */
  chunkTextLength: number;
  /** True when the query matched the escalation (warranty/safety) keywords. */
  isEscalationQuery: boolean;
  /** Similarity floor a lone chunk must clear (SINGLE_CHUNK_STRONG_SIMILARITY). */
  strongSimilarityFloor: number;
  /** Minimum chunk text length a lone chunk must have (SINGLE_CHUNK_MIN_LENGTH). */
  minChunkLength: number;
}

/**
 * Decide whether a lone retrieved chunk is strong enough to support an answer
 * instead of forcing the insufficient-coverage refusal.
 *
 * A single chunk qualifies ONLY when ALL hold:
 *   - exactly one chunk was retrieved (this rule never applies otherwise),
 *   - the query is NOT an escalation (warranty/safety) query — those keep
 *     their stricter two-chunk human-review behavior unchanged,
 *   - similarity >= the strong floor (0.8 — the same bar the weakness gate
 *     has always used), and
 *   - chunk text length >= the minimum (200 chars).
 *
 * This does NOT bypass any post-LLM validation: answers served through this
 * path still go through the full citation/grounding validation, and the
 * limited-coverage prompt caveat still applies. Pure — no side effects.
 */
export function isStrongSingleChunkAnswer(state: SingleChunkAnswerState): boolean {
  if (state.semanticSearchResultsCount !== 1) return false;
  if (state.isEscalationQuery) return false;
  if (state.similarity < state.strongSimilarityFloor) return false;
  if (state.chunkTextLength < state.minChunkLength) return false;
  return true;
}

// ── Lexical Rescue (P3b) ────────────────────────────────────────────────────

/**
 * Inputs for the lexical-rescue trigger decision. All limits are passed in
 * (from constants.ts) so the rule stays pure and testable.
 */
export interface LexicalRescueTriggerState {
  /** Documents with embedding_status = "completed" (i.e. retrievable). */
  docsWithEmbeddingsCount: number;
  /** True only when the semantic retrieval adapter actually executed. */
  retrievalRan: boolean;
  /** Number of qualifying semantic chunks retrieval produced. */
  semanticSearchResultsCount: number;
  /** Minimum qualifying chunks required to answer (MIN_RELEVANT_CHUNKS). */
  minRelevantChunks: number;
  /** True when the query matched the escalation (warranty/safety) keywords. */
  isEscalationQuery: boolean;
  /** Approximate content-word count of the raw query (countQueryContentWords). */
  queryContentWordCount: number;
  /** Minimum content words to bother rescuing (LEXICAL_RESCUE_MIN_QUERY_WORDS). */
  minQueryContentWords: number;
}

/**
 * Decide whether to attempt the strict lexical rescue pass. Rescue is a
 * NARROW recovery path for semantic under-retrieval, never a parallel
 * retrieval mode: it runs ONLY when ALL hold:
 *   - the tenant has indexed (embedded) documents,
 *   - the semantic pass actually ran (a failed/skipped retrieval keeps its
 *     existing retrieval_unavailable abstain — rescue must not mask outages),
 *   - the semantic pass returned fewer than the minimum relevant chunks,
 *   - the query is NOT an escalation (warranty/safety) query — those keep
 *     their stricter posture with no rescue at all, and
 *   - the query has enough lexical content to possibly AND-match (cheap
 *     client-side pre-gate; the RPC's lexeme count is the authoritative gate).
 *
 * Pure — no side effects.
 */
export function shouldAttemptLexicalRescue(state: LexicalRescueTriggerState): boolean {
  if (state.docsWithEmbeddingsCount <= 0) return false;
  if (!state.retrievalRan) return false;
  if (state.isEscalationQuery) return false;
  if (state.semanticSearchResultsCount >= state.minRelevantChunks) return false;
  if (state.queryContentWordCount < state.minQueryContentWords) return false;
  return true;
}

/**
 * Approximate content-word count for the rescue pre-gate: words of 3+
 * characters. Deliberately loose — Postgres stemming/stopword rules differ,
 * so this only short-circuits obviously-too-short queries; the RPC's
 * numnode-based lexeme count is the authoritative gate. Pure.
 */
export function countQueryContentWords(query: string): number {
  const words = query.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [];
  return words.filter((w) => w.length >= 3).length;
}

/**
 * Inputs for the lexical single-chunk answer decision.
 */
export interface LexicalSingleChunkState {
  /** Total chunks (semantic + rescued) available for grounding. */
  totalChunkCount: number;
  /** True only when the lone chunk came from the lexical rescue RPC — i.e.
   *  the strict AND-match + rank/cosine floors were enforced server-side. */
  isLexicalRescueChunk: boolean;
  /** Character length of the lone chunk's text. */
  chunkTextLength: number;
  /** True when the query matched the escalation (warranty/safety) keywords. */
  isEscalationQuery: boolean;
  /** Minimum chunk text length (SINGLE_CHUNK_MIN_LENGTH — same literal the
   *  strong-single-chunk path uses, so the two gates cannot drift apart). */
  minChunkLength: number;
}

/**
 * Decide whether a lone lexically rescued chunk may support an answer instead
 * of forcing the insufficient-coverage refusal. Mirrors
 * {@link isStrongSingleChunkAnswer} but keyed on lexical evidence: the rescue
 * RPC already proved a strict AND-match (every content lexeme of the query is
 * present in the chunk) plus the rank and cosine floors, so the remaining
 * checks are structural. A single chunk qualifies ONLY when ALL hold:
 *   - exactly one chunk total (this rule never applies otherwise),
 *   - that chunk is a lexically rescued chunk (a weak SEMANTIC single chunk
 *     is NOT rescued by this rule — it keeps the existing weakness gate),
 *   - the query is NOT an escalation (warranty/safety) query, and
 *   - chunk text length >= the minimum (200 chars).
 *
 * This does NOT bypass any post-LLM validation: answers served through this
 * path still go through the full citation/grounding validation, and the
 * limited-coverage prompt caveat still applies. Pure — no side effects.
 */
export function isLexicalSingleChunkAnswer(state: LexicalSingleChunkState): boolean {
  if (state.totalChunkCount !== 1) return false;
  if (!state.isLexicalRescueChunk) return false;
  if (state.isEscalationQuery) return false;
  if (state.chunkTextLength < state.minChunkLength) return false;
  return true;
}

/**
 * Decide whether to abstain instead of serving an answer, and why. This closes
 * the retrieval-failure abstain bypass: when a tenant has indexed documents but
 * retrieval could not produce qualifying grounded chunks — whether because it
 * never ran or because it ran with too few results — Sentinel abstains with the
 * canonical grounded-context response rather than letting an ungrounded
 * full-document fallback reach the answer model.
 *
 * Returns `null` (answerable) for:
 *   - tenants with no indexed documents (general-knowledge / onboarding mode), and
 *   - healthy retrieval that met the minimum qualifying-chunk count.
 *
 * Pure — no side effects.
 */
export function decideRetrievalAbstain(state: RetrievalAbstainState): RetrievalAbstainReason | null {
  // Only tenants with indexed (embedded) documents are gated. With nothing
  // embedded, the model answers from general knowledge / the onboarding
  // full-document fallback — preserved behavior, this gate does not apply.
  if (state.docsWithEmbeddingsCount <= 0) return null;

  // Retrieval never ran for a tenant that HAS embedded docs. The only available
  // answer would be an ungrounded full-document fallback, so abstain instead of
  // serving it. (Closes the bypass the master plan flagged as the #1 safety fix.)
  if (!state.retrievalRan) return "retrieval_unavailable";

  // Retrieval ran but produced fewer qualifying chunks than the minimum →
  // ordinary insufficient-coverage abstain — UNLESS the lone chunk qualified
  // as a strong single-chunk answer (non-escalation query, similarity >= 0.8,
  // length >= 200; decided by isStrongSingleChunkAnswer at the call site) OR
  // as a lexical single-chunk answer (strict AND-match rescue, non-escalation,
  // length >= 200; decided by isLexicalSingleChunkAnswer at the call site).
  // Zero chunks always abstain: the overrides only apply to exactly one.
  if (state.semanticSearchResultsCount < state.minRelevantChunks) {
    if (
      state.semanticSearchResultsCount === 1 &&
      (state.strongSingleChunk === true || state.lexicalSingleChunk === true)
    ) {
      return null;
    }
    return "insufficient_retrieval_coverage";
  }

  // Indexed docs + retrieval ran + enough qualifying chunks → answerable.
  return null;
}
