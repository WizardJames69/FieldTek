import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { 
  Building2, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Palette, 
  Settings2, 
  Users, 
  Zap,
  Snowflake,
  Droplets,
  Plug,
  Wrench,
  Layers,
  ArrowUpDown,
  Wifi,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { INDUSTRY_PRESETS, IndustryType } from '@/types/database';

const industries = [
  { id: 'hvac', label: 'HVAC', icon: Snowflake, description: 'Heating, ventilation & air conditioning' },
  { id: 'plumbing', label: 'Plumbing', icon: Droplets, description: 'Pipes, drains & water systems' },
  { id: 'electrical', label: 'Electrical', icon: Plug, description: 'Wiring, panels & electrical systems' },
  { id: 'mechanical', label: 'Mechanical', icon: Wrench, description: 'Industrial & mechanical equipment' },
  { id: 'elevator', label: 'Elevator', icon: ArrowUpDown, description: 'Elevators, escalators & vertical transport' },
  { id: 'home_automation', label: 'Home Automation', icon: Wifi, description: 'Smart home installation & integration' },
  { id: 'general', label: 'General', icon: Layers, description: 'Multi-trade or other services' },
] as const;

const steps = [
  { id: 1, title: 'Company', icon: Building2 },
  { id: 2, title: 'Industry', icon: Settings2 },
  { id: 3, title: 'Branding', icon: Palette },
  { id: 4, title: 'Ready', icon: Zap },
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [setupStatus, setSetupStatus] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  
  // Form data
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState<IndustryType>('general');
  const [primaryColor, setPrimaryColor] = useState('#1e3a5f');
  const [secondaryColor, setSecondaryColor] = useState('#f59e0b');
  
  
  const { user, signOut } = useAuth();
  const { tenant, refreshTenant } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Don't redirect if user is intentionally signing out
    if (isSigningOut) return;
    
    if (!user) {
      navigate('/auth');
    } else if (tenant) {
      navigate('/dashboard');
    } else {
      // Check if this is a portal client who shouldn't be here
      const checkPortalClient = async () => {
        try {
          const { data } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
          if (data) {
            navigate('/portal');
          }
        } catch {
          // Non-critical, continue with onboarding
        }
      };
      checkPortalClient();
    }
  }, [user, tenant, navigate, isSigningOut]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 50) + '-' + Date.now().toString(36);
  };

  const withTimeout = async <T,>(
    promiseLike: PromiseLike<T>,
    ms: number,
    label: string
  ): Promise<T> => {
    const promise = Promise.resolve(promiseLike);
    let timeoutId: number | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
      }, ms);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  };

  const handleComplete = async () => {
    if (!user || !companyName.trim()) {
      console.error('[Onboarding] Cannot proceed: user or companyName missing', {
        hasUser: !!user,
        companyName: companyName.trim(),
      });
      return;
    }

    setIsLoading(true);
    setSetupStatus('Setting up…');

    console.log('[Onboarding] Starting setup for:', {
      companyNameLength: companyName.trim().length,
      industry,
    });

    try {
      const slug = generateSlug(companyName);
      const industryPreset = INDUSTRY_PRESETS[industry];
      const timeoutMs = 30000;
      setSetupError(null);

      // Check for existing tenant (partial recovery from previous failed attempt)
      const { data: existingTU } = await withTimeout(
        supabase
          .from('tenant_users')
          .select('tenant_id')
          .eq('user_id', user.id)
          .maybeSingle(),
        timeoutMs,
        'Checking existing setup'
      );

      let tenantId: string;

      if (existingTU?.tenant_id) {
        // Resume from existing partial setup
        console.log('[Onboarding] Found existing tenant_user, resuming setup', { tenantId: existingTU.tenant_id });
        tenantId = existingTU.tenant_id;
      } else {
        // Step 1: Create tenant
        setSetupStatus('Creating your company…');
        console.log('[Onboarding] Step 1: Creating tenant...');

        const isBetaFounder = user.user_metadata?.is_beta_founder === true;

        const { data: tenantData, error: tenantError } = await withTimeout(
          supabase
            .from('tenants')
            .insert({
              name: companyName.trim(),
              slug,
              industry,
              owner_id: user.id,
              ...(isBetaFounder ? { is_beta_founder: true } : {}),
            })
            .select()
            .single(),
          timeoutMs,
          'Creating company'
        );

        if (tenantError) {
          console.error('[Onboarding] Step 1 FAILED: Tenant creation error', {
            code: tenantError.code,
            message: tenantError.message,
            details: tenantError.details,
            hint: tenantError.hint,
          });
          throw tenantError;
        }
        console.log('[Onboarding] Step 1 SUCCESS: Tenant created', { tenantId: tenantData.id });
        tenantId = tenantData.id;

        // Step 2: Create tenant_user record (owner)
        setSetupStatus('Creating your workspace…');
        console.log('[Onboarding] Step 2: Creating tenant_user record...');
        const { error: tuError } = await withTimeout(
          supabase.from('tenant_users').insert({
            tenant_id: tenantId,
            user_id: user.id,
            role: 'owner',
            is_active: true,
          }),
          timeoutMs,
          'Creating workspace membership'
        );

        if (tuError) {
          console.error('[Onboarding] Step 2 FAILED: tenant_users insert error', {
            code: tuError.code,
            message: tuError.message,
            details: tuError.details,
            hint: tuError.hint,
          });
          throw tuError;
        }
        console.log('[Onboarding] Step 2 SUCCESS: tenant_user created');
      }


      // Step 3: Create tenant settings with industry presets
      setSetupStatus('Applying industry defaults…');
      console.log('[Onboarding] Step 3: Creating tenant_settings...');
      const { error: settingsError } = await withTimeout(
        supabase.from('tenant_settings').insert({
          tenant_id: tenantId,
          equipment_types: industryPreset.equipment_types,
          job_types: industryPreset.job_types,
          workflow_stages: industryPreset.workflow_stages,
          document_categories: industryPreset.document_categories,
        }),
        timeoutMs,
        'Applying industry defaults'
      );

      if (settingsError) {
        console.error('[Onboarding] Step 3 FAILED: tenant_settings insert error', {
          code: settingsError.code,
          message: settingsError.message,
          details: settingsError.details,
          hint: settingsError.hint,
        });
        throw settingsError;
      }
      console.log('[Onboarding] Step 3 SUCCESS: tenant_settings created');

      // Step 4: Create tenant branding
      setSetupStatus('Saving your branding…');
      console.log('[Onboarding] Step 4: Creating tenant_branding...');
      const { error: brandingError } = await withTimeout(
        supabase.from('tenant_branding').insert({
          tenant_id: tenantId,
          company_name: companyName.trim(),
          primary_color: primaryColor,
          secondary_color: secondaryColor,
        }),
        timeoutMs,
        'Saving branding'
      );

      if (brandingError) {
        console.error('[Onboarding] Step 4 FAILED: tenant_branding insert error', {
          code: brandingError.code,
          message: brandingError.message,
          details: brandingError.details,
          hint: brandingError.hint,
        });
        throw brandingError;
      }
      console.log('[Onboarding] Step 4 SUCCESS: tenant_branding created');

      // Step 5: Mark onboarding progress (non-critical)
      setSetupStatus('Finalizing…');
      console.log('[Onboarding] Step 5: Updating onboarding_progress...');
      const { error: progressError } = await withTimeout(
        supabase
          .from('onboarding_progress')
          .update({
            company_info_completed: true,
            company_info_completed_at: new Date().toISOString(),
            branding_completed:
              primaryColor !== '#1e3a5f' || secondaryColor !== '#f59e0b',
            branding_completed_at:
              primaryColor !== '#1e3a5f' || secondaryColor !== '#f59e0b'
                ? new Date().toISOString()
                : null,
          })
          .eq('tenant_id', tenantId),
        timeoutMs,
        'Finalizing onboarding'
      );

      if (progressError) {
        console.error('[Onboarding] Step 5 FAILED: onboarding_progress update error', {
          code: progressError.code,
          message: progressError.message,
          details: progressError.details,
          hint: progressError.hint,
        });
        // Don't throw - this is non-critical
      } else {
        console.log('[Onboarding] Step 5 SUCCESS: onboarding_progress updated');
      }

      // Step 6: Refresh tenant context
      setSetupStatus('Loading your dashboard…');
      console.log('[Onboarding] Step 6: Refreshing tenant context...');
      await withTimeout(refreshTenant(), timeoutMs, 'Loading dashboard');
      console.log('[Onboarding] Step 6 SUCCESS: Tenant context refreshed');

      toast({
        title: 'Welcome aboard!',
        description: "Your company is all set up. Let's get started!",
      });

      console.log('[Onboarding] Setup complete, navigating to dashboard');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('[Onboarding] SETUP FAILED:', {
        errorName: error?.name,
        errorMessage: error?.message,
        errorCode: error?.code,
        errorDetails: error?.details,
        errorHint: error?.hint,
        fullError: error,
      });

      const errorMessage = error?.message || 'Something went wrong. Please try again.';
      setSetupError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Setup failed',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
      setSetupStatus(null);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return companyName.trim().length >= 2;
      case 2: return !!industry;
      default: return true;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6 animate-fade-up">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold">What's your company name?</h2>
              <p className="text-muted-foreground mt-2">This will be displayed throughout your account</p>
            </div>
            <div className="max-w-sm mx-auto">
              <Label htmlFor="companyName">Company name</Label>
              <Input
                id="companyName"
                data-testid="onboarding-company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Smith HVAC Services"
                className="mt-2 text-center text-lg h-12"
                autoFocus
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 animate-fade-up">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold">What industry are you in?</h2>
              <p className="text-muted-foreground mt-2">We'll customize your setup based on your trade</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {industries.map((ind) => {
                const Icon = ind.icon;
                const isSelected = industry === ind.id;
                return (
                  <button
                    key={ind.id}
                    data-testid={`onboarding-industry-${ind.id}`}
                    onClick={() => setIndustry(ind.id as IndustryType)}
                    className={cn(
                      'relative p-6 rounded-xl border-2 text-left transition-all duration-200',
                      isSelected
                        ? 'border-accent bg-accent/5 shadow-lg'
                        : 'border-border bg-card hover:border-accent/50 hover:shadow-md'
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                        <Check className="h-4 w-4 text-accent-foreground" />
                      </div>
                    )}
                    <Icon className={cn('h-8 w-8 mb-3', isSelected ? 'text-accent' : 'text-muted-foreground')} />
                    <h3 className="font-semibold text-foreground">{ind.label}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{ind.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 animate-fade-up">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold">Customize your branding</h2>
              <p className="text-muted-foreground mt-2">Optional: Choose colors that match your brand</p>
            </div>
            <div className="max-w-md mx-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primaryColor">Primary color</Label>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="color"
                      id="primaryColor"
                      data-testid="onboarding-primary-color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-10 rounded cursor-pointer border border-border"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="secondaryColor">Accent color</Label>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="color"
                      id="secondaryColor"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-12 h-10 rounded cursor-pointer border border-border"
                    />
                    <Input
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-lg border border-border bg-card">
                <p className="text-sm text-muted-foreground mb-2">Preview</p>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: primaryColor }}>{companyName || 'Your Company'}</p>
                    <p className="text-sm" style={{ color: secondaryColor }}>Field Service Management</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-8 animate-fade-up text-center">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <Check className="h-10 w-10 text-success" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold">You're all set!</h2>
              <p className="text-muted-foreground mt-2">
                {companyName} is ready to go. Let's start managing your field service operations.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-left">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">Industry</p>
                <p className="text-muted-foreground capitalize">{industry}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">Trial ends</p>
                <p className="text-muted-foreground">30 days</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              You can invite team members later from Settings → Team.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="onboarding-page">
      {/* Header */}
      <header className="border-b border-border py-4 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg">FieldTek</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={isSigningOut}
            onClick={async () => {
              setIsSigningOut(true);
              await signOut();
              navigate('/');
            }}
            className="text-muted-foreground hover:text-foreground gap-2"
          >
            <LogOut className="h-4 w-4" />
            Use different account
          </Button>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="py-8 px-6 border-b border-border">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                        isCompleted ? 'bg-success text-success-foreground' :
                        isCurrent ? 'bg-primary text-primary-foreground' :
                        'bg-muted text-muted-foreground'
                      )}
                    >
                      {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <span className={cn(
                      'text-xs mt-2 font-medium',
                      isCurrent ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={cn(
                      'h-0.5 w-16 sm:w-24 mx-2',
                      currentStep > step.id ? 'bg-success' : 'bg-border'
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          {renderStep()}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Show setup status when loading */}
          {setupStatus && (
            <div className="text-center mb-4 text-sm text-muted-foreground animate-pulse">
              {setupStatus}
            </div>
          )}
          
          {/* Show error with retry button */}
          {setupError && !isLoading && (
            <div className="text-center mb-4">
              <p className="text-sm text-destructive mb-2">{setupError}</p>
              <Button
                variant="outline"
                size="sm"
                data-testid="onboarding-retry"
                onClick={() => {
                  setSetupError(null);
                  handleComplete();
                }}
              >
                Try Again
              </Button>
            </div>
          )}
          
          <div className="flex justify-between">
            <Button
              variant="outline"
              data-testid="onboarding-back"
              onClick={async () => {
                if (currentStep === 1) {
                  // Sign out so Landing page doesn't auto-redirect back to onboarding
                  setIsSigningOut(true);
                  await signOut();
                  navigate('/');
                } else {
                  setCurrentStep(currentStep - 1);
                }
              }}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {currentStep === 1 ? 'Exit' : 'Back'}
            </Button>
            
            {currentStep < 4 ? (
              <Button
                data-testid="onboarding-continue"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceed()}
                className="gap-2"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                data-testid="onboarding-launch"
                onClick={handleComplete}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? 'Setting up...' : 'Launch Dashboard'}
                <Zap className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
