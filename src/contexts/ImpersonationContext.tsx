import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { checkIsPlatformAdmin } from '@/lib/authRouting';
import type { Tenant, TenantSettings, TenantBranding } from '@/types/database';

interface ImpersonatedTenantData {
  tenant: Tenant;
  settings: TenantSettings | null;
  branding: TenantBranding | null;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedTenant: ImpersonatedTenantData | null;
  startImpersonation: (tenantId: string) => Promise<void>;
  stopImpersonation: () => void;
  loading: boolean;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

const STORAGE_KEY = 'impersonated_tenant_id';

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [impersonatedTenant, setImpersonatedTenant] = useState<ImpersonatedTenantData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTenantData = useCallback(async (tenantId: string): Promise<ImpersonatedTenantData | null> => {
    try {
      const [tenantResult, settingsResult, brandingResult] = await Promise.all([
        supabase.from('tenants').select('*').eq('id', tenantId).single(),
        supabase.from('tenant_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('tenant_branding').select('*').eq('tenant_id', tenantId).maybeSingle(),
      ]);

      if (tenantResult.error || !tenantResult.data) {
        console.error('Error fetching impersonated tenant:', tenantResult.error);
        return null;
      }

      return {
        tenant: tenantResult.data as Tenant,
        settings: settingsResult.data as unknown as TenantSettings | null,
        branding: brandingResult.data as TenantBranding | null,
      };
    } catch (error) {
      console.error('Error in fetchTenantData:', error);
      return null;
    }
  }, []);

  // Restore impersonation from localStorage on mount (only if user is platform admin)
  useEffect(() => {
    const storedTenantId = localStorage.getItem(STORAGE_KEY);
    if (storedTenantId) {
      setLoading(true);
      checkIsPlatformAdmin().then(async ({ isAdmin }) => {
        if (!isAdmin) {
          console.error('Impersonation blocked: user is not a platform admin');
          localStorage.removeItem(STORAGE_KEY);
          setLoading(false);
          return;
        }
        const data = await fetchTenantData(storedTenantId);
        if (data) {
          setImpersonatedTenant(data);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
        setLoading(false);
      });
    }
  }, [fetchTenantData]);

  const startImpersonation = async (tenantId: string) => {
    setLoading(true);

    // Verify the user is a platform admin before allowing impersonation
    const { isAdmin } = await checkIsPlatformAdmin();
    if (!isAdmin) {
      console.error('Impersonation blocked: user is not a platform admin');
      setLoading(false);
      return;
    }

    const data = await fetchTenantData(tenantId);
    if (data) {
      setImpersonatedTenant(data);
      localStorage.setItem(STORAGE_KEY, tenantId);
    }
    setLoading(false);
  };

  const stopImpersonation = () => {
    setImpersonatedTenant(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating: !!impersonatedTenant,
        impersonatedTenant,
        startImpersonation,
        stopImpersonation,
        loading,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider');
  }
  return context;
}
