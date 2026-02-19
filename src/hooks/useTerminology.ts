import { useMemo, useContext } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { DemoSandboxContext } from '@/contexts/DemoSandboxContext';
import { 
  INDUSTRY_TERMINOLOGY, 
  TerminologyKey, 
  IndustryTerminology,
  IndustryType 
} from '@/config/industryTerminology';

export function useTerminology() {
  // Check for demo context first (safe - returns null if outside provider)
  const demoContext = useContext(DemoSandboxContext);
  const { tenant } = useTenant();
  
  // In demo mode, use demo industry; otherwise use tenant industry
  const industry: IndustryType = demoContext?.isDemo 
    ? demoContext.industry 
    : ((tenant?.industry as IndustryType) || 'general');
  
  const terminology = useMemo((): IndustryTerminology => {
    return INDUSTRY_TERMINOLOGY[industry] || INDUSTRY_TERMINOLOGY.general;
  }, [industry]);

  // Helper function for getting a term
  const t = (key: TerminologyKey): string => terminology[key];

  return { terminology, t, industry };
}

// For use outside of TenantContext (e.g., demo pages)
export function useTerminologyWithIndustry(industry?: IndustryType | null) {
  const effectiveIndustry = industry || 'general';
  
  const terminology = useMemo((): IndustryTerminology => {
    return INDUSTRY_TERMINOLOGY[effectiveIndustry] || INDUSTRY_TERMINOLOGY.general;
  }, [effectiveIndustry]);

  const t = (key: TerminologyKey): string => terminology[key];

  return { terminology, t, industry: effectiveIndustry };
}
