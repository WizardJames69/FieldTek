import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  rollout_percentage: number;
  allowed_tenant_ids: string[] | null;
  blocked_tenant_ids: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

// Simple hash function for consistent percentage assignment
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Consistent hashing ensures same tenant always gets same result for a given flag
function hashTenantToPercentage(tenantId: string, flagKey: string): number {
  const hash = simpleHash(`${tenantId}:${flagKey}`);
  return hash % 100;
}

async function fetchFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch feature flags:', error);
    return [];
  }

  return (data || []) as FeatureFlag[];
}

export function useFeatureFlags() {
  const { tenant } = useTenant();

  const { data: flags, isLoading, error, refetch } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: fetchFeatureFlags,
    staleTime: 60000, // Cache for 1 minute
    gcTime: 300000, // Keep in cache for 5 minutes
  });

  const isEnabled = (flagKey: string): boolean => {
    if (!flags) return false;
    
    const flag = flags.find(f => f.key === flagKey);
    
    // Flag doesn't exist or is disabled (kill switch)
    if (!flag || !flag.is_enabled) return false;
    
    // No tenant context - can't evaluate tenant-specific rules
    if (!tenant?.id) return false;
    
    // Check blocklist first - blocked tenants never get the feature
    if (flag.blocked_tenant_ids?.includes(tenant.id)) return false;
    
    // Check allowlist - allowed tenants always get the feature
    if (flag.allowed_tenant_ids?.includes(tenant.id)) return true;
    
    // Check time window
    const now = new Date();
    if (flag.starts_at && new Date(flag.starts_at) > now) return false;
    if (flag.ends_at && new Date(flag.ends_at) < now) return false;
    
    // Percentage rollout using consistent hashing
    // This ensures the same tenant always gets the same result for this flag
    const tenantPercentile = hashTenantToPercentage(tenant.id, flagKey);
    return tenantPercentile < flag.rollout_percentage;
  };

  // Get a specific flag's details
  const getFlag = (flagKey: string): FeatureFlag | undefined => {
    return flags?.find(f => f.key === flagKey);
  };

  return { 
    isEnabled, 
    getFlag,
    flags: flags || [], 
    isLoading, 
    error,
    refetch 
  };
}

// Export types for use in other components
export type { FeatureFlag };
