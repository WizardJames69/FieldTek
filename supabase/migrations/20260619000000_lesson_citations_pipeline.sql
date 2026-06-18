-- ============================================================
-- Sentinel AI v2 — Approved Learning Loop, PR-3a
-- Lesson citations: backend foundation (schema + flag) ONLY
-- ============================================================
-- Adds the storage foundation for *publishing* an approved lesson into the
-- EXISTING tenant document pipeline so it can later be retrieved and cited
-- like any uploaded document. This migration is purely additive:
--
--   * documents.file_url becomes nullable (a lesson has no uploaded file)
--   * documents.source / documents.source_id mark a document's provenance
--     and link a "lesson" document back to its originating lesson_candidate
--   * lesson_candidates.published_document_id links a lesson to the document
--     it was published into (idempotency + cleanup + future UI state)
--   * a feature_flags row `lesson_citations`, DEFAULT OFF
--   * a partial index for lesson-document lookups/cleanup
--
-- IMPORTANT — this migration does NOT make any lesson citable on its own:
--   * No document or chunk rows are created here.
--   * Retrieval, citation, abstain, prompts, thresholds are UNTOUCHED.
--   * The publishing path (promote-lesson edge function) is gated by the
--     `lesson_citations` flag, which defaults OFF. The retrieval-time gate
--     and the Publish UI land in later PRs (PR-3b).
--
-- Migration safety: fresh timestamp AFTER 20260618000000 (current HEAD's
-- PR-2 policy) and after the 7 deferred workflow migrations. Additive only;
-- does NOT touch any existing policy or the 7 deferred workflow migrations.
-- Apply ONLY via the documented single-file method (never `supabase db push`).

-- ── documents.file_url nullable (lessons carry no uploaded file) ──────────
ALTER TABLE public.documents ALTER COLUMN file_url DROP NOT NULL;

-- ── documents.source: system-truth provenance ('upload' | 'lesson') ──────
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload';

-- Guarded check constraint (ADD CONSTRAINT has no IF NOT EXISTS form).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.documents'::regclass
      AND conname = 'documents_source_check'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_source_check CHECK (source IN ('upload', 'lesson'));
  END IF;
END $$;

-- ── documents.source_id: back-link to the originating lesson candidate ────
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source_id uuid
    REFERENCES public.lesson_candidates(id) ON DELETE SET NULL;

-- ── lesson_candidates.published_document_id: the document it was published into
ALTER TABLE public.lesson_candidates
  ADD COLUMN IF NOT EXISTS published_document_id uuid
    REFERENCES public.documents(id) ON DELETE SET NULL;

-- ── Feature flag: lesson_citations (DEFAULT OFF) ─────────────────────────
INSERT INTO public.feature_flags (key, name, description, is_enabled, rollout_percentage)
VALUES (
  'lesson_citations',
  'Lesson Citations',
  'When enabled, approved lessons can be published into the tenant document pipeline and cited by Sentinel like any other document. Gates both publication and (in a later PR) retrieval. Default OFF.',
  false,
  0
)
ON CONFLICT (key) DO NOTHING;

-- ── Lesson-document lookups / cleanup ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_documents_lesson_source
  ON public.documents (tenant_id, source_id)
  WHERE source = 'lesson';
