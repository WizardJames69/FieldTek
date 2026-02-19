-- Allow portal clients to read their own client record.
-- Without this, PortalAuthContext's fetchClientRecord() query is blocked by RLS,
-- causing the portal login to hang indefinitely (client state stays null).
CREATE POLICY "Portal clients can view their own record"
  ON public.clients
  FOR SELECT
  USING (user_id = auth.uid());
