import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useImpersonation } from './ImpersonationContext';
import type { Tenant, TenantUser, TenantSettings, TenantBranding, AppRole, IndustryType } from '@/types/database';
import { readTenantSnapshot, writeTenantSnapshot, removeTenantSnapshot } from '@/lib/tenantSnapshot';

/**
 * Discriminates WHY the workspace has no resolved role, so routing can react
 * correctly instead of collapsing every null-role case into an error:
 *  - 'loading'       — a fetch is in flight (or the user just changed).
 *  - 'ready'         — a tenant membership loaded successfully (role is set).
 *  - 'no-membership' — the tenant_users query returned EMPTY after retries; the
 *                      user simply hasn't onboarded (or is a portal client).
 *                      Route them onward, do NOT show a workspace error.
 *  - 'load-error'    — the query/RLS/network failed after retries; this is the
 *                      only case that should surface WorkspaceLoadError.
 */
export type WorkspaceStatus = 'loading' | 'ready' | 'no-membership' | 'load-error';

interface TenantContextType {
  tenant: Tenant | null;
  tenantUser: TenantUser | null;
  settings: TenantSettings | null;
  branding: TenantBranding | null;
  loading: boolean;
  role: AppRole | null;
  isAdmin: boolean;
  isOwner: boolean;
  workspaceStatus: WorkspaceStatus;
  refreshTenant: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  isImpersonating: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// Offline tenant snapshot helpers live in @/lib/tenantSnapshot (a leaf module
// shared with the AuthContext sign-out cleanup path).

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isImpersonating, impersonatedTenant } = useImpersonation();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantUser, setTenantUser] = useState<TenantUser | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>('loading');

  // Track which user ID we last completed a fetch for.
  // This prevents a race condition where AuthContext resolves (user becomes non-null)
  // but TenantContext's useEffect hasn't fired yet to set loading=true.
  // During that gap, loading is false and tenant is null — which would cause
  // pages like Equipment.tsx to falsely redirect to /onboarding.
  const fetchedForUserRef = useRef<string | null>(null);

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
      fetchedForUserRef.current = null;
      retryCountRef.current = 0;
      emptyResultRetryRef.current = 0;
      sessionRefreshAttemptedRef.current = false;
      return;
    }

    // Offline cold-open: hydrate from the persisted snapshot instead of burning
    // the retry chain on requests that cannot succeed. If no snapshot exists,
    // fall through to the normal fetch path (fails safely exactly as before).
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const snapshot = readTenantSnapshot(user.id);
      if (snapshot) {
        console.log('Offline: hydrating tenant context from local snapshot');
        setTenantUser(snapshot.tenantUser);
        setTenant(snapshot.tenant);
        setSettings(snapshot.settings);
        setBranding(snapshot.branding);
        setWorkspaceStatus('ready');
        setLoading(false);
        fetchedForUserRef.current = user.id;
        return;
      }
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

        // After max retries, clear state and stop loading. A query/RLS/network
        // failure — NOT a confirmed absence of membership — so surface the error.
        console.error('Max retries reached, stopping tenant fetch');
        setTenant(null);
        setTenantUser(null);
        setSettings(null);
        setBranding(null);
        setWorkspaceStatus('load-error');
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

        // After empty retries exhausted, user truly has no tenant membership.
        // This is a DEFINITIVE empty result (not an error) — the user needs
        // onboarding (or is a portal client). Routing reacts to 'no-membership';
        // it must NOT be shown a workspace error.
        console.log('No tenant membership found after retries - user needs onboarding');
        // Membership is confirmed gone — a stale snapshot must not grant offline access.
        removeTenantSnapshot(user.id);
        setTenant(null);
        setTenantUser(null);
        setSettings(null);
        setBranding(null);
        setWorkspaceStatus('no-membership');
        setLoading(false);
        retryCountRef.current = 0;
        emptyResultRetryRef.current = 0;
        sessionRefreshAttemptedRef.current = false;
        return;
      }

      // Successfully found tenant user — reset empty-result counter only.
      // Do NOT reset retryCountRef here: the catch block uses it to cap error
      // retries and resetting it after each successful tenant_users query
      // causes an infinite retry loop when the subsequent parallel fetch fails.
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
      setWorkspaceStatus('ready');

      // Persist the successful load so the app shell can cold-open offline
      // (RoleGuard role, SubscriptionGuard tier, branding). Real data only —
      // impersonation is layered at render time and never reaches this fetch.
      writeTenantSnapshot(user.id, {
        tenantUser: tenantUserData as TenantUser,
        tenant: tenantResult.data as Tenant,
        settings: settingsResult.data as unknown as TenantSettings | null,
        branding: brandingResult.data as TenantBranding | null,
      });
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
        // Went offline mid-retry: fill any still-missing state from the
        // snapshot instead of leaving the shell blank. Functional updates
        // only fill nulls — data already loaded is never replaced.
        let filledFromSnapshot = false;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const snapshot = readTenantSnapshot(user.id);
          if (snapshot) {
            console.log('Offline after failed fetch: filling tenant context from local snapshot');
            setTenantUser((current) => current ?? snapshot.tenantUser);
            setTenant((current) => current ?? snapshot.tenant);
            setSettings((current) => current ?? snapshot.settings);
            setBranding((current) => current ?? snapshot.branding);
            filledFromSnapshot = true;
          }
        }
        // A genuine load failure (query/RLS/network/timeout) surfaces the error,
        // unless we recovered usable data from the offline snapshot.
        setWorkspaceStatus(filledFromSnapshot ? 'ready' : 'load-error');
        setLoading(false);
        fetchedForUserRef.current = user?.id ?? null;
      }
    } finally {
      // Only the latest request should control the loading flag.
      if (requestId === requestIdRef.current && !didScheduleRetry) {
        setLoading(false);
        fetchedForUserRef.current = user?.id ?? null;
      }
    }
  };

  const refreshTenant = async () => {
    // Reset retries and force a fresh fetch when the user presses "Retry"
    clearPendingRetry();
    retryCountRef.current = 0;
    emptyResultRetryRef.current = 0;
    sessionRefreshAttemptedRef.current = false;
    setWorkspaceStatus('loading');
    setLoading(true);
    await fetchTenantData(true);
  };

  // Depend on the user's ID (a primitive string) rather than the user object reference.
  // AuthContext fires setUser() from both onAuthStateChange and getSession(), producing
  // two distinct object references for the same user.  Using [user] would trigger this
  // effect twice, each time incrementing requestIdRef and discarding the previous
  // in-flight fetch — leaving effectiveLoading stuck at true forever.
  const userId = user?.id ?? null;

  useEffect(() => {
    // Cancel stale async work when auth changes
    clearPendingRetry();
    requestIdRef.current++;
    retryCountRef.current = 0;
    emptyResultRetryRef.current = 0;
    sessionRefreshAttemptedRef.current = false;

    // Don't clear branding immediately to prevent flash
    if (user) {
      setWorkspaceStatus('loading');
      setLoading(true);
      fetchTenantData();
    } else {
      setTenant(null);
      setTenantUser(null);
      setSettings(null);
      setBranding(null);
      setWorkspaceStatus('loading');
      setLoading(false);
    }

    return () => {
      clearPendingRetry();
    };
  }, [userId]);

  // Use impersonated tenant data when impersonating
  const effectiveTenant = isImpersonating && impersonatedTenant ? impersonatedTenant.tenant : tenant;
  const effectiveSettings = isImpersonating && impersonatedTenant ? impersonatedTenant.settings : settings;
  const effectiveBranding = isImpersonating && impersonatedTenant ? impersonatedTenant.branding : branding;

  // When impersonating, give admin access to view everything
  const role = isImpersonating ? 'owner' : (tenantUser?.role ?? null);
  const isAdmin = isImpersonating || role === 'admin' || role === 'owner';
  const isOwner = isImpersonating || role === 'owner';

  // Derived loading: true when a fetch is actively running OR when the user changed
  // but we haven't started fetching yet (gap between AuthContext resolving and our useEffect firing).
  // This prevents downstream components from seeing loading=false with stale tenant=null.
  const effectiveLoading = loading || (!!user && fetchedForUserRef.current !== user.id);

  // Effective workspace status mirrors effectiveLoading (so a status from a prior
  // user isn't read during the auth→tenant gap) and treats impersonation as ready.
  const effectiveWorkspaceStatus: WorkspaceStatus = isImpersonating
    ? 'ready'
    : effectiveLoading
      ? 'loading'
      : workspaceStatus;

  return (
    <TenantContext.Provider
      value={{
        tenant: effectiveTenant,
        tenantUser,
        settings: effectiveSettings,
        branding: effectiveBranding,
        loading: effectiveLoading,
        role,
        isAdmin,
        isOwner,
        workspaceStatus: effectiveWorkspaceStatus,
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