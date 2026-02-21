-- C3: Restrict DELETE on clients to admin/owner only (technicians should not delete clients)
DROP POLICY IF EXISTS "Staff can manage clients" ON public.clients;

CREATE POLICY "Staff can view clients"
  ON public.clients FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Staff can create clients"
  ON public.clients FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Staff can update clients"
  ON public.clients FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can delete clients"
  ON public.clients FOR DELETE
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin());


-- C4: Restrict DELETE on equipment to admin/owner only
DROP POLICY IF EXISTS "Staff can manage equipment" ON public.equipment_registry;

CREATE POLICY "Staff can view equipment"
  ON public.equipment_registry FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Staff can create equipment"
  ON public.equipment_registry FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Staff can update equipment"
  ON public.equipment_registry FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can delete equipment"
  ON public.equipment_registry FOR DELETE
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin());


-- H4: Fix part receipts storage policy — add tenant folder isolation
DROP POLICY IF EXISTS "Users can view part receipts in their tenant" ON storage.objects;

CREATE POLICY "Users can view part receipts in their tenant"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'part-receipts'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  );
