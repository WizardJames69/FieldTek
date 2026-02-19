import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useImpersonation } from './ImpersonationContext';
import type { Tenant, TenantUser, TenantSettings, TenantBranding, AppRole, IndustryType } from '@/types/database';

interface TenantContextType {
  tenant: Tenant | null;
  tenantUser: TenantUser | null;
  settings: TenantSettings | null;
  branding: TenantBranding | null;
  loading: boolean;
  role: AppRole | null;
  isAdmin: boolean;
  isOwner: boolean;
  refreshTenant: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  isImpersonating: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isImpersonating, impersonatedTenant } = useImpersonation();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantUser, setTenantUser] = useState<TenantUser | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [loading, setLoading] = useState(true);

  // Retry bookkeeping
  const retryCountRef = useRef(0);
  const emptyResultRetryRef = useRef(0);
  const sessionRefreshAttemptedRef = useRef(false);
  const pendingRetryTimeoutRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  const maxRetries = 2;
  const maxEmptyRetries = 3; // Extra retries for empty results (post-checkout race condition)
  const queryTimeoutMs = 10000; // Increased for slow connections
  const maxBackoffMs = 10000; // Cap exponential backoff at 10s

  // Exponential backoff: 1s, 2s, 4s, 8s... capped at maxBackoffMs
  const getBackoffDelay = (attempt: number): number => {
    return Math.min(1000 * Math.pow(2, attempt - 1), maxBackoffMs);
  };

  const withTimeout = async <T,>(
    promiseLike: PromiseLike<T>,
    ms: number,
    label: string
  ): Promise<T> => {
    const promise = Promise.resolve(promiseLike);
    let timeoutId: number | undefined;

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  };

  const clearPendingRetry = () => {
    if (pendingRetryTimeoutRef.current) {
      window.clearTimeout(pendingRetryTimeoutRef.current);
      pendingRetryTimeoutRef.current = null;
    }
  };

  // Expose session refresh for external use (e.g., Dashboard retry button)
  const refreshSession = async (): Promise<boolean> => {
    try {
      console.log('Refreshing auth session...');
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Session refresh failed:', error);
        return false;
      }
      console.log('Session refreshed successfully');
      return true;
    } catch (err) {
      console.error('Session refresh error:', err);
      return false;
    }
  };

  const fetchTenantData = async (isRetry = false) => {
    let didScheduleRetry = false;

    // Cancel any previously scheduled retry before starting a new run.
    clearPendingRetry();

    // This request id lets us ignore stale async results (auth refreshes, fast navigation, etc.)
    const requestId = ++requestIdRef.current;

    if (!user) {
      setTenant(null);
      setTenantUser(null);
      setSettings(null);
      setBranding(null);
      setLoading(false);
      retryCountRef.current = 0;
      emptyResultRetryRef.current = 0;
      sessionRefreshAttemptedRef.current = false;
      return;
    }

    try {
      // Ensure a manual refresh forces the context into a loading state.
      if (isRetry) {
        setLoading(true);
      }

      // Small delay on initial load to ensure auth token is fully propagated to RLS
      if (!isRetry && retryCountRef.current === 0 && emptyResultRetryRef.current === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Get user's tenant membership
      const { data: tenantUserData, error: tuError } = await withTimeout(
        supabase
          .from('tenant_users')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        queryTimeoutMs,
        'Fetching workspace membership'
      );

      // Ignore stale results.
      if (requestId !== requestIdRef.current) return;

      if (tuError) {
        console.error('Error fetching tenant_users:', tuError);

        // Retry if we haven't exceeded max retries
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          const attempt = retryCountRef.current;
          const delay = getBackoffDelay(attempt);
          console.log(`Retrying tenant fetch (attempt ${attempt}/${maxRetries}, delay ${delay}ms)...`);

          didScheduleRetry = true;
          pendingRetryTimeoutRef.current = window.setTimeout(() => fetchTenantData(true), delay);
          return;
        }

        // After max retries, clear state and stop loading
        console.error('Max retries reached, stopping tenant fetch');
        setTenant(null);
        setTenantUser(null);
        setSettings(null);
        setBranding(null);
        setLoading(false);
        return;
      }

      if (!tenantUserData) {
        // Empty result - might be RLS timing issue after checkout
        if (emptyResultRetryRef.current < maxEmptyRetries) {
          emptyResultRetryRef.current++;
          const attempt = emptyResultRetryRef.current;
          const delay = getBackoffDelay(attempt);
          console.log(
            `No tenant_users found, retrying for RLS propagation (attempt ${attempt}/${maxEmptyRetries}, delay ${delay}ms)...`
          );

          // After 2 empty attempts, try refreshing the session
          if (attempt === 2 && !sessionRefreshAttemptedRef.current) {
            sessionRefreshAttemptedRef.current = true;
            console.log('Attempting session refresh to resolve potential JWT timing issue...');
            await refreshSession();
          }

          didScheduleRetry = true;
          pendingRetryTimeoutRef.current = window.setTimeout(() => fetchTenantData(true), delay);
          return;
        }

        // After empty retries exhausted, user truly has no tenant membership
        console.log('No tenant membership found after retries - user needs onboarding');
        setTenant(null);
        setTenantUser(null);
        setSettings(null);
        setBranding(null);
        setLoading(false);
        retryCountRef.current = 0;
        emptyResultRetryRef.current = 0;
        sessionRefreshAttemptedRef.current = false;
        return;
      }

      // Successfully found tenant user - reset retry counters
      retryCountRef.current = 0;
      emptyResultRetryRef.current = 0;
      sessionRefreshAttemptedRef.current = false;

      setTenantUser(tenantUserData as TenantUser);

      // Fetch tenant, settings, and branding in parallel (each with its own timeout)
      const [tenantResult, settingsResult, brandingResult] = await Promise.all([
        withTimeout(
          supabase.from('tenants').select('*').eq('id', tenantUserData.tenant_id).single(),
          queryTimeoutMs,
          'Fetching tenant'
        ),
        withTimeout(
          supabase.from('tenant_settings').select('*').eq('tenant_id', tenantUserData.tenant_id).maybeSingle(),
          queryTimeoutMs,
          'Fetching tenant settings'
        ),
        withTimeout(
          supabase.from('tenant_branding').select('*').eq('tenant_id', tenantUserData.tenant_id).maybeSingle(),
          queryTimeoutMs,
          'Fetching tenant branding'
        ),
      ]);

      if (requestId !== requestIdRef.current) return;

      if (tenantResult.error) {
        console.error('Error fetching tenant:', tenantResult.error);
        throw tenantResult.error;
      }

      setTenant(tenantResult.data as Tenant);
      setSettings(settingsResult.data as unknown as TenantSettings | null);
      setBranding(brandingResult.data as TenantBranding | null);
    } catch (error) {
      // Treat timeouts and transient errors as retryable
      if (requestId === requestIdRef.current) {
        console.error('Error fetching tenant data:', error);
        
        // Retry on exceptions (including timeouts) if we haven't exhausted retries
        const totalAttempts = retryCountRef.current + emptyResultRetryRef.current;
        if (totalAttempts < maxRetries + maxEmptyRetries) {
          retryCountRef.current++;
          const attempt = retryCountRef.current;
          const delay = getBackoffDelay(attempt);
          console.log(`Retrying after error (attempt ${attempt}/${maxRetries}, delay ${delay}ms)...`);
          
          didScheduleRetry = true;
          pendingRetryTimeoutRef.current = window.setTimeout(() => fetchTenantData(true), delay);
          return;
        }
        
        // After all retries exhausted, stop loading but don't clear existing data
        // This prevents "flash of fallback branding" if we already have data
        console.error('All retries exhausted after error');
        setLoading(false);
      }
    } finally {
      // Only the latest request should control the loading flag.
      if (requestId === requestIdRef.current && !didScheduleRetry) {
        setLoading(false);
      }
    }
  };

  const refreshTenant = async () => {
    // Reset retries and force a fresh fetch when the user presses "Retry"
    clearPendingRetry();
    retryCountRef.current = 0;
    emptyResultRetryRef.current = 0;
    sessionRefreshAttemptedRef.current = false;
    setLoading(true);
    await fetchTenantData(true);
  };

  useEffect(() => {
    // Cancel stale async work when auth changes
    clearPendingRetry();
    requestIdRef.current++;
    retryCountRef.current = 0;
    emptyResultRetryRef.current = 0;
    sessionRefreshAttemptedRef.current = false;

    // Don't clear branding immediately to prevent flash
    if (user) {
      setLoading(true);
      fetchTenantData();
    } else {
      setTenant(null);
      setTenantUser(null);
      setSettings(null);
      setBranding(null);
      setLoading(false);
    }

    return () => {
      clearPendingRetry();
    };
  }, [user]);

  // Use impersonated tenant data when impersonating
  const effectiveTenant = isImpersonating && impersonatedTenant ? impersonatedTenant.tenant : tenant;
  const effectiveSettings = isImpersonating && impersonatedTenant ? impersonatedTenant.settings : settings;
  const effectiveBranding = isImpersonating && impersonatedTenant ? impersonatedTenant.branding : branding;

  // When impersonating, give admin access to view everything
  const role = isImpersonating ? 'owner' : (tenantUser?.role ?? null);
  const isAdmin = isImpersonating || role === 'admin' || role === 'owner';
  const isOwner = isImpersonating || role === 'owner';

  return (
    <TenantContext.Provider
      value={{
        tenant: effectiveTenant,
        tenantUser,
        settings: effectiveSettings,
        branding: effectiveBranding,
        loading,
        role,
        isAdmin,
        isOwner,
        refreshTenant,
        refreshSession,
        isImpersonating,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

export function useTenantSettings() {
  const { settings } = useTenant();
  return settings;
}

export function useBranding() {
  const { branding, tenant } = useTenant();
  return {
    ...branding,
    companyName: branding?.company_name || tenant?.name || 'FieldTek',
  };
}

export function useUserRole() {
  const { role, isAdmin, isOwner } = useTenant();
  return { role, isAdmin, isOwner };
}