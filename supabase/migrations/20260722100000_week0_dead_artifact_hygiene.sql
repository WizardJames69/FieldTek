-- ============================================================
-- Week 0 dead-artifact hygiene (Workstream B3, founder-approved 2026-07-22)
-- ============================================================
-- Removals verified read-only before this migration was written
-- (Step 0 of the Week 0 plan). Every dropped object has ZERO readers
-- and writers outside migrations + the generated types file:
--
-- 1. pending_invitations — superseded by team_invitations (the active
--    invitation system; AcceptInvite.tsx + accept_team_invitation RPC
--    + PendingInvitationsList.tsx all operate on team_invitations).
--    No component, function, script, or test queries this table. No
--    inbound foreign keys. Its RLS policies drop with the table.
--
-- 2. tenants_public — a security_invoker view (20260203061900) with no
--    .from('tenants_public') caller anywhere; it survives only as FK
--    resolution metadata in generated types. Public pages read tenant
--    identity from URL params, not this view.
--
-- Deliberately NOT dropped (verification failed the "dead" claim):
--   * documents.is_public — load-bearing in two live policies
--     ("Users can view documents in their tenant", 20260107061503, and
--     "Document files follow documents table access", 20260706000000)
--     and written by e2e/demo seeds. The audit's "dead column" call was
--     wrong; recorded in docs/week0-summary.md.
--   * profiles.certifications / skills / notification_preferences —
--     kept per founder decision (a real certifications feature replaces
--     them in weeks 9-12); marked deprecated below instead.
-- ============================================================

DROP TABLE IF EXISTS public.pending_invitations;

DROP VIEW IF EXISTS public.tenants_public;

-- Deprecation markers only — columns intentionally left in place.
COMMENT ON COLUMN public.profiles.certifications IS
  'DEPRECATED (2026-07-22, Week 0): never read or written by application code. Kept until the weeks-9-12 certifications feature replaces it with a real table. Do not build on this column.';
COMMENT ON COLUMN public.profiles.skills IS
  'DEPRECATED (2026-07-22, Week 0): never read or written by application code. Kept until the weeks-9-12 certifications/skills feature replaces it. Do not build on this column.';
COMMENT ON COLUMN public.profiles.notification_preferences IS
  'DEPRECATED (2026-07-22, Week 0): never read or written by application code (portal notification prefs are JSON inside clients.notes — also slated for a real home). Do not build on this column.';
