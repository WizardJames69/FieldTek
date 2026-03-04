// ============================================================
// Field Assistant — Audit Logging & Conversation Tracking
// ============================================================

import { CITATION_PATTERN } from "./constants.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// ── Audit Log Data Interface ────────────────────────────────

export interface AuditLogData {
  tenantId: string;
  userId: string;
  userMessageText: string;
  // deno-lint-ignore no-explicit-any
  context: any;
  accumulatedContent: string;
  validationFailed: boolean;
  failureReason: string;
  matchedPatterns: string[];
  // deno-lint-ignore no-explicit-any
  tenantDocs: any[];
  // deno-lint-ignore no-explicit-any
  docsWithContent: any[];
  docNames: string[];
  injectionDetected: boolean;
  semanticSearchResults: Array<{ id: string; similarity: number; chunk_type?: string; keyword_rank?: number | null }>;
  systemPromptHash: string;
  systemPrompt: string;
  // deno-lint-ignore no-explicit-any
  messages: any[];
  rqScore: number;
  responseModified: boolean;
  humanReviewRequired: boolean;
  humanReviewReasons: string[];
  enforcementRulesTriggered: string[];
  correlationId: string;
  chatGatewayUsed: string;
  requestStartTime: number;
  maxSim: number | null;
  avgSim: number | null;
  minSim: number | null;
  keywordMatchCount: number;
  chunkTypesRetrieved: string[];
  retrievalBackend: string;
  rerankScores: number[] | null;
  rerankModel: string | null;
  rerankLatencyMs: number | null;
  insufficientRetrievalCoverage: boolean;
}

// ── Write Audit Log ─────────────────────────────────────────

export async function writeAuditLog(
  serviceRoleClient: SupabaseClient,
  data: AuditLogData,
): Promise<string | null> {
  const responseTimeMs = Date.now() - data.requestStartTime;
  const hasCitations = CITATION_PATTERN.test(data.accumulatedContent);

  // Estimate token counts (rough: 1 token ~ 4 chars)
  const estPromptTokens = Math.round((data.systemPrompt.length + JSON.stringify(data.messages).length) / 4);
  const estResponseTokens = Math.round(data.accumulatedContent.length / 4);

  // Compute SHA-256 of final response for determinism verification
  const mainOutputHashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data.accumulatedContent));
  const mainModelOutputHash = Array.from(new Uint8Array(mainOutputHashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

  // Compute citation density (citations per 1000 chars)
  const citationMatches = data.accumulatedContent.match(/\[Source:\s*\S[^\]]*\]/gi) || [];
  const citationDensity = data.accumulatedContent.length > 0 ? citationMatches.length / (data.accumulatedContent.length / 1000) : 0;

  // Abstain flag
  const abstainFlag = data.validationFailed || data.insufficientRetrievalCoverage || (data.semanticSearchResults.length === 0 && data.docsWithContent.length > 0);

  try {
    const { data: auditRow } = await serviceRoleClient.from("ai_audit_logs").insert({
      tenant_id: data.tenantId,
      user_id: data.userId,
      user_message: data.userMessageText.slice(0, 10000),
      context_type: data.context?.job ? "job" : data.context?.equipment ? "equipment" : null,
      context_id: data.context?.job?.id || data.context?.equipment?.id || null,
      equipment_type: data.context?.equipment?.equipment_type || null,
      ai_response: data.accumulatedContent.slice(0, 50000),
      response_blocked: data.validationFailed,
      block_reason: data.validationFailed ? data.failureReason : null,
      documents_available: data.tenantDocs?.length || 0,
      documents_with_content: data.docsWithContent.length,
      document_names: data.docNames,
      validation_patterns_matched: data.injectionDetected
        ? [...(data.matchedPatterns.length > 0 ? data.matchedPatterns : []), "PROMPT_INJECTION_DETECTED"]
        : (data.matchedPatterns.length > 0 ? data.matchedPatterns : null),
      had_citations: hasCitations,
      response_time_ms: responseTimeMs,
      model_used: "google/gemini-2.5-flash",
      correlation_id: data.correlationId,
      chunk_ids: data.semanticSearchResults.map(r => r.id),
      similarity_scores: data.semanticSearchResults.map(r => r.similarity),
      system_prompt_hash: data.systemPromptHash,
      retrieval_quality_score: data.rqScore,
      token_count_prompt: estPromptTokens,
      token_count_response: estResponseTokens,
      injection_detected: data.injectionDetected,
      semantic_search_count: data.semanticSearchResults.length,
      response_modified: data.responseModified,
      human_review_required: data.humanReviewRequired,
      human_review_reasons: data.humanReviewReasons.length > 0 ? data.humanReviewReasons : null,
      human_review_status: data.humanReviewRequired ? 'pending' : null,
      refusal_flag: data.validationFailed,
      enforcement_rules_triggered: data.enforcementRulesTriggered.length > 0 ? data.enforcementRulesTriggered : null,
      model_output_hash: mainModelOutputHash,
      diagnostic_data: data.context?.diagnosticData || null,
      max_similarity: data.maxSim,
      avg_similarity: data.avgSim,
      min_similarity: data.minSim,
      keyword_match_count: data.keywordMatchCount,
      citation_density: citationDensity,
      abstain_flag: abstainFlag,
      chunk_types_retrieved: data.chunkTypesRetrieved.length > 0 ? data.chunkTypesRetrieved : null,
      retrieval_backend: data.retrievalBackend,
      gateway_used: data.chatGatewayUsed,
      rerank_scores: data.rerankScores,
      rerank_model: data.rerankModel,
      rerank_latency_ms: data.rerankLatencyMs,
    }).select("id").single();

    const auditLogId = auditRow?.id || null;
    console.log("Audit log created - blocked:", data.validationFailed, "response_time:", responseTimeMs, "ms");
    return auditLogId;
  } catch (auditError) {
    console.error("Failed to create audit log:", auditError);
    return null;
  }
}

// ── Conversation Tracking ───────────────────────────────────

export async function trackConversation(
  serviceRoleClient: SupabaseClient,
  params: {
    tenantId: string;
    userId: string;
    userMessageText: string;
    accumulatedContent: string;
    validationFailed: boolean;
    hasCitations: boolean;
    humanReviewRequired: boolean;
    // deno-lint-ignore no-explicit-any
    context: any;
    requestConversationId: string | null;
  },
): Promise<void> {
  try {
    let conversationId = params.requestConversationId;

    if (!conversationId) {
      const { data: newConv } = await serviceRoleClient
        .from("conversations")
        .insert({
          tenant_id: params.tenantId,
          user_id: params.userId,
          title: params.userMessageText.slice(0, 100) || "New Conversation",
          context_type: params.context?.job ? "job" : params.context?.equipment ? "equipment" : null,
          context_id: params.context?.job?.id || params.context?.equipment?.id || null,
        })
        .select("id")
        .single();
      conversationId = newConv?.id;
    }

    if (conversationId) {
      await serviceRoleClient.from("messages").insert([
        {
          conversation_id: conversationId,
          role: "user",
          content: params.userMessageText.slice(0, 50000),
          metadata: { correlation_id: null },
        },
        {
          conversation_id: conversationId,
          role: "assistant",
          content: params.validationFailed
            ? "[Response blocked by validation]"
            : params.accumulatedContent.slice(0, 50000),
          metadata: {
            blocked: params.validationFailed,
            had_citations: params.hasCitations,
            human_review_required: params.humanReviewRequired,
          },
        },
      ]);
    }
  } catch (convError) {
    console.error("Conversation tracking error:", convError);
  }
}
