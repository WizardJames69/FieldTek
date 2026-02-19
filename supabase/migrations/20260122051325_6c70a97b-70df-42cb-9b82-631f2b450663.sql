-- Add RLS policy for portal clients to view their own equipment
CREATE POLICY "Portal clients can view their own equipment"
ON public.equipment_registry
FOR SELECT
USING (
  client_id IN (
    SELECT id FROM public.clients 
    WHERE user_id = auth.uid()
  )
);

-- Add RLS policy for portal clients to view jobs on their equipment
CREATE POLICY "Portal clients can view jobs on their equipment"
ON public.scheduled_jobs
FOR SELECT
USING (
  -- Allow viewing if the job is linked to equipment they own
  equipment_id IN (
    SELECT er.id FROM public.equipment_registry er
    JOIN public.clients c ON c.id = er.client_id
    WHERE c.user_id = auth.uid()
  )
  OR
  -- Also allow viewing if the job is directly linked to their client record
  client_id IN (
    SELECT id FROM public.clients
    WHERE user_id = auth.uid()
  )
);