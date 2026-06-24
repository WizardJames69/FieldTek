// ============================================================
// Sentinel AI v2 — Approved Learning Loop, PR-3 (unpublish)
// unpublish-lesson: remove a lesson's published document from the pipeline
// ============================================================
// Platform-admin-only. Deletes the "lesson" document a lesson was published to
// (its chunks cascade; the FK nulls the lesson's published_document_id) so the
// lesson is no longer retrievable or citable.
//
// Deliberately NOT gated by the `lesson_citations` feature flag. Unpublish is a
// removal/cleanup action: during a rollback or incident the flag may already be
// off, and a platform admin must still be able to remove a published lesson
// document. Publish/Republish stay flag-gated (promote-lesson); unpublish does
// not. Safety comes from identity, not the flag — `decideUnpublish` refuses to
// delete anything that is not unambiguously this lesson's own lesson document,
// so a normal uploaded document can never be removed here.
//
// This function makes NO retrieval/citation/abstain/prompt change and does not
// touch search_document_chunks. Auth + admin check + service client + error
// shape mirror promote-lesson (platform-admin functions, not listed in
// config.toml → default verify_jwt=true).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { decideUnpublish } from "./lesson-unpublish.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      .select("id, tenant_id, published_document_id")
      .eq("id", lessonId)
      .maybeSingle();
    if (lessonError) {
      return json({ error: `Failed to load lesson: ${lessonError.message}` }, 500);
    }
    if (!lesson) return json({ error: "Lesson not found", code: "not_found" }, 404);

    // ── 4. Load the linked document (if any) ─────────────────────────────
    let document = null;
    if (lesson.published_document_id) {
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("id, tenant_id, source, source_id")
        .eq("id", lesson.published_document_id)
        .maybeSingle();
      if (docError) {
        return json({ error: `Failed to load lesson document: ${docError.message}` }, 500);
      }
      document = doc;
    }

    // ── 5. Decide (pure; ownership/identity only, no flag) ───────────────
    const decision = decideUnpublish({ lesson, document });

    // ── 6. Act ───────────────────────────────────────────────────────────
    switch (decision.action) {
      case "noop":
        // Never published — idempotent success, nothing removed.
        return json({ unpublished: false, code: decision.code }, 200);

      case "clear_link": {
        // Dangling link: the document is already gone. Clear the stale pointer.
        const { error: clearErr } = await supabase
          .from("lesson_candidates")
          .update({ published_document_id: null })
          .eq("id", lesson.id);
        if (clearErr) {
          return json({ error: `Failed to clear lesson link: ${clearErr.message}` }, 500);
        }
        return json({ unpublished: true, code: decision.code, document_id: null }, 200);
      }

      case "refuse":
        // The linked document is not unambiguously this lesson's lesson
        // document — refuse rather than risk deleting an unrelated document.
        return json(
          {
            error:
              "The linked document is not this lesson's published lesson document; refusing to delete it.",
            code: decision.code,
          },
          409,
        );

      case "delete": {
        // Delete the document first so a failure leaves the link intact (a
        // consistent "still published" state). Chunks cascade; the
        // published_document_id FK is ON DELETE SET NULL, but clear it
        // explicitly afterward so the post-state never depends on FK config.
        const { error: delErr } = await supabase
          .from("documents")
          .delete()
          .eq("id", decision.documentId);
        if (delErr) {
          return json(
            { error: `Failed to remove lesson document: ${delErr.message}` },
            500,
          );
        }
        const { error: clearErr } = await supabase
          .from("lesson_candidates")
          .update({ published_document_id: null })
          .eq("id", lesson.id);
        if (clearErr) {
          // Document is gone; the link will also have been nulled by the FK.
          // Report success but note the explicit clear failed for observability.
          return json(
            {
              unpublished: true,
              document_id: decision.documentId,
              warning: `Document removed but explicit link clear failed: ${clearErr.message}`,
            },
            200,
          );
        }
        return json({ unpublished: true, document_id: decision.documentId }, 200);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[unpublish-lesson] ERROR:", msg);
    return json({ error: msg }, 500);
  }
});
