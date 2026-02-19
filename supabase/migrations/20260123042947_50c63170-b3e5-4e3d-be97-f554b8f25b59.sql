-- Fix waitlist_signups INSERT policy to add basic validation instead of WITH CHECK (true)
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist_signups;

CREATE POLICY "Anyone can join waitlist"
ON public.waitlist_signups
FOR INSERT
WITH CHECK (email IS NOT NULL AND email != '');