// ============================================================
// Sentinel AI v2 — Approved Learning Loop, PR-3a
// promote-lesson: publish an approved lesson into the document pipeline
// ============================================================
// Platform-admin-only. Creates a "lesson" document from an APPROVED lesson
// candidate and hands it to the EXISTING generate-embeddings pipeline so it
// becomes retrievable like any uploaded document. Gated by the
// `lesson_citations` feature flag (default OFF) per the lesson's tenant.
//
// This function makes NO retrieval/citation/abstain/prompt change. It only
// creates a document + triggers embeddings. The retrieval-time flag gate and
// the Publish UI land in PR-3b. Auth + admin check + service client + error
// shape mirror admin-revenue / admin-tenant-health (platform-admin functions,
// not listed in config.toml → default verify_jwt=true).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { evaluateFeatureFlag } from "../field-assistant/auth.ts";
import { buildLessonDocumentInsert, canPromoteLesson } from "./lesson-publish.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FLAG_KEY = "lesson_citations";

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // ── 1. Platform-admin auth ───────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header provided" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const { data: adminData, error: adminError } = await supabase
      .from("platform_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (adminError || !adminData) {
      return json({ error: "Access denied: Platform admin privileges required" }, 403);
    }

    // ── 2. Input ─────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const lessonId: unknown = body?.lessonId ?? body?.lesson_id;
    if (!lessonId || typeof lessonId !== "string") {
      return json({ error: "lessonId is required" }, 400);
    }

    // ── 3. Load lesson ───────────────────────────────────────────────────
    const { data: lesson, error: lessonError } = await supabase
      .from("lesson_candidates")
      .select(
        "id, tenant_id, question, proposed_answer, equipment_type, status, published_document_id",
      )
      .eq("id", lessonId)
      .maybeSingle();
    if (lessonError) {
      return json({ error: `Failed to load lesson: ${lessonError.message}` }, 500);
    }
    if (!lesson) return json({ error: "Lesson not found", code: "not_found" }, 404);

    // ── 4. Require approved status ───────────────────────────────────────
    if (lesson.status !== "approved") {
      return json(
        { error: "Only approved lessons can be published.", code: "not_approved" },
        409,
      );
    }

    // ── 5. Feature flag (publish-time gate) ──────────────────────────────
    const flagEnabled = await evaluateFeatureFlag(supabase, FLAG_KEY, lesson.tenant_id);
    if (!canPromoteLesson(lesson.status, flagEnabled)) {
      return json(
        { error: "lesson_citations is not enabled for this tenant.", code: "flag_disabled" },
        403,
      );
    }

    const correlationId = crypto.randomUUID();

    // ── 6. Idempotency: drop a prior published document so chunks cascade ─
    // and the recreated document reflects the current lesson text.
    if (lesson.published_document_id) {
      const { data: existingDoc } = await supabase
        .from("documents")
        .select("id")
        .eq("id", lesson.published_document_id)
        .maybeSingle();
      if (existingDoc) {
        const { error: delErr } = await supabase
          .from("documents")
          .delete()
          .eq("id", existingDoc.id);
        if (delErr) {
          return json(
            { error: `Failed to remove prior lesson document: ${delErr.message}` },
            500,
          );
        }
      }
    }

    // ── 7. Insert the lesson document ────────────────────────────────────
    const insertPayload = buildLessonDocumentInsert({
      tenantId: lesson.tenant_id,
      question: lesson.question,
      proposedAnswer: lesson.proposed_answer,
      equipmentType: lesson.equipment_type,
      lessonId: lesson.id,
      uploadedBy: user.id,
    });

    const { data: insertedDoc, error: insertError } = await supabase
      .from("documents")
      .insert({ ...insertPayload, correlation_id: correlationId })
      .select("id")
      .single();
    if (insertError || !insertedDoc) {
      return json(
        { error: `Failed to create lesson document: ${insertError?.message ?? "unknown error"}` },
        500,
      );
    }
    const documentId = insertedDoc.id;

    // ── 8. Link lesson → document (clean up the doc if linking fails) ─────
    const { error: linkError } = await supabase
      .from("lesson_candidates")
      .update({ published_document_id: documentId })
      .eq("id", lesson.id);
    if (linkError) {
      await supabase.from("documents").delete().eq("id", documentId);
      return json({ error: `Failed to link lesson to document: ${linkError.message}` }, 500);
    }

    // ── 9. Generate embeddings via the EXISTING pipeline ─────────────────
    const { data: embedData, error: embedError } = await supabase.functions.invoke(
      "generate-embeddings",
      { body: { documentId, correlationId } },
    );
    if (embedError) {
      // The document exists and is linked; embeddings are retryable. Report
      // partial success rather than orphaning/rolling back the document.
      return json(
        {
          document_id: documentId,
          embedding_status: "pending",
          correlation_id: correlationId,
          warning:
            `Document created but embedding generation failed: ${embedError.message}. It can be retried.`,
        },
        207,
      );
    }

    return json(
      {
        document_id: documentId,
        embedding_status: "completed",
        chunks_created: embedData?.chunksCreated ?? null,
        correlation_id: correlationId,
      },
      200,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[promote-lesson] ERROR:", msg);
    return json({ error: msg }, 500);
  }
});
