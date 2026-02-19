import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  DEMO_TOOLTIPS,
} from '@/data/demoSandboxData';
import { 
  DEMO_FEATURES_CHECKLIST_EXTENDED,
  getResolvedChecklistItem,
} from '@/config/demoTourConfig';
import { getDemoDataForIndustry, type DemoDataSet } from '@/data/industryDemoData';
import { IndustryType } from '@/config/industryTerminology';

interface DemoSandboxContextType {
  isDemo: boolean;
  sessionToken: string | null;
  industry: IndustryType;
  demoTenant: DemoDataSet['tenant'];
  demoBranding: DemoDataSet['branding'];
  demoSettings: DemoDataSet['settings'];
  demoTeam: DemoDataSet['team'];
  demoUser: { id: string; name: string; email: string; role: 'owner' };
  featuresExplored: string[];
  markFeatureExplored: (featureId: string) => void;
  showTooltips: boolean;
  setShowTooltips: (show: boolean) => void;
  currentTooltipIndex: number;
  setCurrentTooltipIndex: (index: number) => void;
  getTooltipsForPage: (path: string) => typeof DEMO_TOOLTIPS;
  featureChecklist: ReturnType<typeof getResolvedChecklistItem>[];
  checklistProgress: number;
  // Tour state
  tourStepIndex: number;
  setTourStepIndex: (index: number) => void;
  tourCompleted: boolean;
  setTourCompleted: (completed: boolean) => void;
  // Demo data accessors
  getDemoClients: () => DemoDataSet['clients'];
  getDemoEquipment: () => DemoDataSet['equipment'];
  getDemoJobs: () => DemoDataSet['jobs'];
  getDemoInvoices: () => DemoDataSet['invoices'];
  getDemoInvoiceLineItems: (invoiceId: string) => DemoDataSet['invoiceLineItems'];
  getDemoServiceRequests: () => DemoDataSet['serviceRequests'];
  // Session management
  endDemoSession: () => void;
  captureLeadInfo: (email: string, name?: string, company?: string) => Promise<void>;
}

const DemoSandboxContext = createContext<DemoSandboxContextType | null>(null);

export function DemoSandboxProvider({
  children,
  sessionToken,
  industry = 'general',
}: {
  children: React.ReactNode;
  sessionToken: string;
  industry?: IndustryType;
}) {
  const location = useLocation();
  const [featuresExplored, setFeaturesExplored] = useState<string[]>([]);
  const [pagesVisited, setPagesVisited] = useState<string[]>([]);
  const [showTooltips, setShowTooltips] = useState(true);
  const [currentTooltipIndex, setCurrentTooltipIndex] = useState(0);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourCompleted, setTourCompleted] = useState(false);

  // Get industry-specific demo data
  const demoData = useMemo(() => getDemoDataForIndustry(industry), [industry]);

  // Demo user (prospect exploring as owner)
  const demoUser = {
    id: 'demo-prospect',
    name: 'Demo User',
    email: 'demo@example.com',
    role: 'owner' as const,
  };

  // Track actual pages visited (separate from features explored)
  useEffect(() => {
    const currentPath = location.pathname;
    setPagesVisited(prev => {
      if (prev.includes(currentPath)) return prev;
      return [...prev, currentPath];
    });
  }, [location.pathname]);

  // Get resolved checklist items with industry terminology
  const featureChecklist = useMemo(() => 
    DEMO_FEATURES_CHECKLIST_EXTENDED.map(item => getResolvedChecklistItem(item, industry)),
    [industry]
  );

  // Track page visits and mark features as explored
  useEffect(() => {
    const currentPath = location.pathname;
    // Strip /demo prefix for matching against feature paths
    const pathWithoutDemo = currentPath.replace(/^\/demo/, '') || '/dashboard';
    const feature = featureChecklist.find(f => pathWithoutDemo.startsWith(f.path));
    
    if (feature && !featuresExplored.includes(feature.id)) {
      markFeatureExplored(feature.id);
    }
  }, [location.pathname, featureChecklist]);

  const markFeatureExplored = useCallback(async (featureId: string) => {
    if (featuresExplored.includes(featureId)) return;

    const newExplored = [...featuresExplored, featureId];
    setFeaturesExplored(newExplored);

    // Update session in database using security definer function
    // Use actual pagesVisited state (not features explored)
    try {
      const updatedPagesVisited = [...new Set([...pagesVisited, location.pathname])];
      await supabase.rpc('update_demo_sandbox_session_by_token', {
        p_session_token: sessionToken,
        p_features_explored: newExplored,
        p_pages_visited: updatedPagesVisited,
        p_last_activity_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to update demo session:', error);
    }
  }, [featuresExplored, pagesVisited, sessionToken, location.pathname]);

  const getTooltipsForPage = useCallback((path: string) => {
    return DEMO_TOOLTIPS.filter(t => t.page === path).sort((a, b) => a.order - b.order);
  }, []);

  const checklistProgress = (featuresExplored.length / featureChecklist.length) * 100;

  // Data accessors - now using industry-specific data
  const getDemoClients = useCallback(() => demoData.clients, [demoData]);
  const getDemoEquipment = useCallback(() => demoData.equipment, [demoData]);
  const getDemoJobs = useCallback(() => demoData.jobs, [demoData]);
  const getDemoInvoices = useCallback(() => demoData.invoices, [demoData]);
  const getDemoInvoiceLineItems = useCallback(
    (invoiceId: string) => demoData.invoiceLineItems.filter(item => item.invoice_id === invoiceId),
    [demoData]
  );
  const getDemoServiceRequests = useCallback(() => demoData.serviceRequests, [demoData]);

  const endDemoSession = useCallback(async () => {
    try {
      await supabase.rpc('update_demo_sandbox_session_by_token', {
        p_session_token: sessionToken,
        p_last_activity_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to end demo session:', error);
    }
  }, [sessionToken]);

  const captureLeadInfo = useCallback(async (email: string, name?: string, company?: string) => {
    try {
      await supabase.rpc('update_demo_sandbox_session_by_token', {
        p_session_token: sessionToken,
        p_email: email,
        p_name: name || null,
        p_company_name: company || null,
        p_last_activity_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to capture lead info:', error);
    }
  }, [sessionToken]);

  const value: DemoSandboxContextType = {
    isDemo: true,
    sessionToken,
    industry,
    demoTenant: demoData.tenant,
    demoBranding: demoData.branding,
    demoSettings: demoData.settings,
    demoTeam: demoData.team,
    demoUser,
    featuresExplored,
    markFeatureExplored,
    showTooltips,
    setShowTooltips,
    currentTooltipIndex,
    setCurrentTooltipIndex,
    getTooltipsForPage,
    featureChecklist,
    checklistProgress,
    tourStepIndex,
    setTourStepIndex,
    tourCompleted,
    setTourCompleted,
    getDemoClients,
    getDemoEquipment,
    getDemoJobs,
    getDemoInvoices,
    getDemoInvoiceLineItems,
    getDemoServiceRequests,
    endDemoSession,
    captureLeadInfo,
  };

  return (
    <DemoSandboxContext.Provider value={value}>
      {children}
    </DemoSandboxContext.Provider>
  );
}

export function useDemoSandbox() {
  const context = useContext(DemoSandboxContext);
  if (!context) {
    throw new Error('useDemoSandbox must be used within a DemoSandboxProvider');
  }
  return context;
}

// Hook to check if we're in demo mode (safe to use outside provider)
export function useIsDemo() {
  const context = useContext(DemoSandboxContext);
  return context?.isDemo ?? false;
}

// Hook to get demo industry (safe to use outside provider)
export function useDemoIndustry(): IndustryType | null {
  const context = useContext(DemoSandboxContext);
  return context?.industry ?? null;
}

// Hook to get demo data if in demo mode, otherwise return null
export function useDemoData() {
  const context = useContext(DemoSandboxContext);
  if (!context?.isDemo) return null;
  
  return {
    clients: context.getDemoClients(),
    equipment: context.getDemoEquipment(),
    jobs: context.getDemoJobs(),
    invoices: context.getDemoInvoices(),
    serviceRequests: context.getDemoServiceRequests(),
    team: context.demoTeam,
    tenant: context.demoTenant,
    settings: context.demoSettings,
    branding: context.demoBranding,
  };
}

// Export the context for use in terminology hook
export { DemoSandboxContext };
