import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

/**
 * Hook that automatically checks and updates onboarding progress milestones
 * based on actual data in the database.
 */
export function useOnboardingProgressSync() {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  // Fetch current progress
  const { data: progress } = useQuery({
    queryKey: ['onboarding-progress', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Check for clients
  const { data: hasClients } = useQuery({
    queryKey: ['onboarding-check-clients', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return false;
      const { count } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);
      return (count || 0) > 0;
    },
    enabled: !!tenant?.id && !progress?.first_client_added,
  });

  // Check for jobs
  const { data: hasJobs } = useQuery({
    queryKey: ['onboarding-check-jobs', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return false;
      const { count } = await supabase
        .from('scheduled_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);
      return (count || 0) > 0;
    },
    enabled: !!tenant?.id && !progress?.first_job_created,
  });

  // Check for invoices
  const { data: hasInvoices } = useQuery({
    queryKey: ['onboarding-check-invoices', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return false;
      const { count } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);
      return (count || 0) > 0;
    },
    enabled: !!tenant?.id && !progress?.first_invoice_created,
  });

  // Check for team invites
  const { data: hasTeamMembers } = useQuery({
    queryKey: ['onboarding-check-team', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return false;
      const { count } = await supabase
        .from('tenant_users')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);
      // More than 1 means someone besides the owner
      return (count || 0) > 1;
    },
    enabled: !!tenant?.id && !progress?.first_team_member_invited,
  });

  // Check for branding
  const { data: hasBranding } = useQuery({
    queryKey: ['onboarding-check-branding', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return false;
      const { data } = await supabase
        .from('tenant_branding')
        .select('logo_url, primary_color')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      // Consider branding complete if they have a custom color or logo
      return data?.logo_url || (data?.primary_color && data?.primary_color !== '#1e3a5f');
    },
    enabled: !!tenant?.id && !progress?.branding_completed,
  });

  // Check for documents
  const { data: hasDocuments } = useQuery({
    queryKey: ['onboarding-check-documents', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return false;
      const { count } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);
      return (count || 0) > 0;
    },
    enabled: !!tenant?.id && !progress?.first_document_uploaded,
  });

  // Check for service requests
  const { data: hasServiceRequests } = useQuery({
    queryKey: ['onboarding-check-service-requests', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return false;
      const { count } = await supabase
        .from('service_requests')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);
      return (count || 0) > 0;
    },
    enabled: !!tenant?.id && !progress?.first_service_request_received,
  });

  // Check for Stripe Connect
  const { data: hasStripeConnect } = useQuery({
    queryKey: ['onboarding-check-stripe-connect', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return false;
      const { data } = await supabase
        .from('tenants')
        .select('stripe_connect_status')
        .eq('id', tenant.id)
        .maybeSingle();
      return data?.stripe_connect_status === 'connected';
    },
    enabled: !!tenant?.id && !progress?.stripe_connect_completed,
  });

  // Sync progress when milestones are detected
  useEffect(() => {
    if (!tenant?.id || !progress) return;

    const updates: Record<string, any> = {};

    if (hasClients && !progress.first_client_added) {
      updates.first_client_added = true;
      updates.first_client_added_at = new Date().toISOString();
    }

    if (hasJobs && !progress.first_job_created) {
      updates.first_job_created = true;
      updates.first_job_created_at = new Date().toISOString();
    }

    if (hasInvoices && !progress.first_invoice_created) {
      updates.first_invoice_created = true;
      updates.first_invoice_created_at = new Date().toISOString();
    }

    if (hasTeamMembers && !progress.first_team_member_invited) {
      updates.first_team_member_invited = true;
      updates.first_team_member_invited_at = new Date().toISOString();
    }

    if (hasBranding && !progress.branding_completed) {
      updates.branding_completed = true;
      updates.branding_completed_at = new Date().toISOString();
    }

    if (hasDocuments && !progress.first_document_uploaded) {
      updates.first_document_uploaded = true;
      updates.first_document_uploaded_at = new Date().toISOString();
    }

    if (hasServiceRequests && !progress.first_service_request_received) {
      updates.first_service_request_received = true;
      updates.first_service_request_received_at = new Date().toISOString();
    }

    if (hasStripeConnect && !progress.stripe_connect_completed) {
      updates.stripe_connect_completed = true;
      updates.stripe_connect_completed_at = new Date().toISOString();
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      supabase
        .from('onboarding_progress')
        .update(updates)
        .eq('tenant_id', tenant.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['onboarding-progress', tenant.id] });
        });
    }
  }, [tenant?.id, progress, hasClients, hasJobs, hasInvoices, hasTeamMembers, hasBranding, hasDocuments, hasServiceRequests, hasStripeConnect, queryClient]);
}
