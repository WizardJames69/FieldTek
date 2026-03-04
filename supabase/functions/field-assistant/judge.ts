// ============================================================
// Judge Model — Async Post-Generation Grounding Evaluation
// ============================================================
// Evaluates whether an AI response is grounded in the retrieved
// document chunks. Runs AFTER the response is streamed to the
// user and the audit log is created. Updates the audit log row
// with grounding, confidence, and contradiction scores.
//
// Non-blocking: failures are logged but never affect the user.
// ============================================================

import { fetchWithFallback } from "../_shared/aiClient.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface JudgeResult {
  grounded: boolean;
  confidence: number;
  contradiction_detected: boolean;
  explanation: string;
}

const JUDGE_MODEL = "gpt-4.1-mini";
const JUDGE_MAX_TOKENS = 200;
const JUDGE_TIMEOUT_MS = 5000;

/**
 * Asynchronously evaluate the AI response for grounding against retrieved chunks.
 *
 * This function is fire-and-forget — it catches all errors internally
 * and never throws. The caller should still `.catch()` for safety.
 *
 * @param serviceRoleClient  Supabase client with service role (for updating audit log)
 * @param auditLogId         The ID of the ai_audit_logs row to update
 * @param userQuery          The user's original question
 * @param retrievedChunks    Array of chunk texts from retrieval
 * @param aiResponse         The AI-generated response text
 * @param correlationId      Correlation ID for tracing
 * @param apiKey             API key for the AI gateway
 */
export async function evaluateWithJudge(
  serviceRoleClient: SupabaseClient,
  auditLogId: string,
  userQuery: string,
  retrievedChunks: string[],
  aiResponse: string,
  correlationId: string,
  apiKey: string,
): Promise<void> {
  const startTime = Date.now();

  // Format retrieved chunks with truncation to stay within token budget
  const chunksText = retrievedChunks
    .slice(0, 8) // Max 8 chunks
    .map((c, i) => `[Chunk ${i + 1}]: ${c.slice(0, 500)}`)
    .join("\n");

  const judgePrompt = `You are a grounding verification judge for a field-service AI assistant.

TASK: Evaluate whether the ANSWER is grounded in the RETRIEVED CHUNKS.

QUERY: ${userQuery.slice(0, 500)}

RETRIEVED CHUNKS:
${chunksText.slice(0, 3000)}

ANSWER:
${aiResponse.slice(0, 2000)}

Respond ONLY with valid JSON:
{
  "grounded": true/false,
  "confidence": 1-5,
  "contradiction_detected": true/false,
  "explanation": "Brief explanation (max 100 words)"
}

Rules:
- grounded=true: ALL factual claims in the answer are supported by the chunks
- grounded=false: ANY factual claim lacks chunk support
- confidence: 1=very uncertain, 5=very confident in your assessment
- contradiction_detected: true if the answer contradicts information in the chunks
- Ignore formatting, tone, and structure — focus only on factual accuracy
- "I don't have enough information" responses are grounded=true (correct abstention)`;

  try {
    const { response, gatewayUsed } = await fetchWithFallback(
      "/chat/completions",
      {
        model: JUDGE_MODEL,
        messages: [{ role: "user", content: judgePrompt }],
        temperature: 0,
        max_tokens: JUDGE_MAX_TOKENS,
        response_format: { type: "json_object" },
      },
      apiKey,
      correlationId,
    );

    if (!response.ok) {
      console.warn(
        `[judge] [correlation_id=${correlationId}] API returned ${response.status} (${gatewayUsed})`,
      );
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.warn(`[judge] [correlation_id=${correlationId}] Empty response from judge model`);
      return;
    }

    // Parse judge response — handle markdown code fences if present
    let judgment: JudgeResult;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
      judgment = JSON.parse(cleanContent);
    } catch (parseErr) {
      console.warn(
        `[judge] [correlation_id=${correlationId}] Failed to parse judge response:`,
        parseErr,
      );
      return;
    }

    const latencyMs = Date.now() - startTime;

    // Update the audit log row with judge results
    const { error: updateError } = await serviceRoleClient
      .from("ai_audit_logs")
      .update({
        judge_grounded: Boolean(judgment.grounded),
        judge_confidence: Math.min(5, Math.max(1, Math.round(judgment.confidence || 3))),
        judge_contradiction: Boolean(judgment.contradiction_detected),
        judge_explanation: (judgment.explanation || "").slice(0, 500),
        judge_model: JUDGE_MODEL,
        judge_latency_ms: latencyMs,
      })
      .eq("id", auditLogId);

    if (updateError) {
      console.warn(
        `[judge] [correlation_id=${correlationId}] Failed to update audit log:`,
        updateError,
      );
      return;
    }

    console.log(
      `[judge] [correlation_id=${correlationId}] grounded=${judgment.grounded} confidence=${judgment.confidence} contradiction=${judgment.contradiction_detected} latency=${latencyMs}ms (${gatewayUsed})`,
    );
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    console.warn(
      `[judge] [correlation_id=${correlationId}] Error after ${latencyMs}ms:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ── Synchronous Judge (for blocking mode) ─────────────────────

/**
 * Synchronous judge evaluation for blocking/warning mode.
 * Returns the JudgeResult instead of updating the audit log.
 * On any error or timeout, returns null (graceful degradation).
 */
export async function evaluateWithJudgeBlocking(
  userQuery: string,
  retrievedChunks: string[],
  aiResponse: string,
  correlationId: string,
  apiKey: string,
): Promise<{ result: JudgeResult; latencyMs: number; gatewayUsed: string } | null> {
  const startTime = Date.now();

  const chunksText = retrievedChunks
    .slice(0, 8)
    .map((c, i) => `[Chunk ${i + 1}]: ${c.slice(0, 500)}`)
    .join("\n");

  const judgePrompt = `You are a grounding verification judge for a field-service AI assistant.

TASK: Evaluate whether the ANSWER is grounded in the RETRIEVED CHUNKS.

QUERY: ${userQuery.slice(0, 500)}

RETRIEVED CHUNKS:
${chunksText.slice(0, 3000)}

ANSWER:
${aiResponse.slice(0, 2000)}

Respond ONLY with valid JSON:
{
  "grounded": true/false,
  "confidence": 1-5,
  "contradiction_detected": true/false,
  "explanation": "Brief explanation (max 100 words)"
}

Rules:
- grounded=true: ALL factual claims in the answer are supported by the chunks
- grounded=false: ANY factual claim lacks chunk support
- confidence: 1=very uncertain, 5=very confident in your assessment
- contradiction_detected: true if the answer contradicts information in the chunks
- Ignore formatting, tone, and structure — focus only on factual accuracy
- "I don't have enough information" responses are grounded=true (correct abstention)`;

  try {
    const { response, gatewayUsed } = await fetchWithFallback(
      "/chat/completions",
      {
        model: JUDGE_MODEL,
        messages: [{ role: "user", content: judgePrompt }],
        temperature: 0,
        max_tokens: JUDGE_MAX_TOKENS,
        response_format: { type: "json_object" },
      },
      apiKey,
      correlationId,
    );

    if (!response.ok) {
      console.warn(
        `[judge-blocking] [correlation_id=${correlationId}] API returned ${response.status} (${gatewayUsed})`,
      );
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.warn(`[judge-blocking] [correlation_id=${correlationId}] Empty response`);
      return null;
    }

    const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
    const judgment: JudgeResult = JSON.parse(cleanContent);
    const latencyMs = Date.now() - startTime;

    console.log(
      `[judge-blocking] [correlation_id=${correlationId}] grounded=${judgment.grounded} confidence=${judgment.confidence} latency=${latencyMs}ms (${gatewayUsed})`,
    );

    return { result: judgment, latencyMs, gatewayUsed };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    console.warn(
      `[judge-blocking] [correlation_id=${correlationId}] Error after ${latencyMs}ms:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
