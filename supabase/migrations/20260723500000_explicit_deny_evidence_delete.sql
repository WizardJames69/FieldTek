-- ============================================================
-- Week 0 security batch C5 (founder-approved 2026-07-22:
-- "explicit deny-all, no admin DELETE")
-- workflow_step_evidence: make delete-denial explicit
-- ============================================================
-- workflow_step_evidence (20260420000000) shipped with SELECT / INSERT /
-- UPDATE policies and no DELETE policy, so RLS already default-denied
-- deletes for every non-service-role caller. That silence read as an
-- oversight (tracked as the PR-SEC-6 follow-up); it is now a decision:
-- field evidence is immutable to clients. This no-op-by-construction
-- policy documents the denial in the schema itself.
--
-- Deliberately NOT an admin-scoped DELETE: the table's writers are the
-- active evidence-capture path (verify-step-evidence + technician
-- inserts), and granting deletion would CREATE an evidence-tampering
-- capability that does not exist today. Evidence lifecycle (retention,
-- correction, appeal) is a product design item deferred to the
-- form-engine work.
-- ============================================================

CREATE POLICY "Evidence rows are immutable to clients"
ON public.workflow_step_evidence
FOR DELETE
TO authenticated
USING (false);
