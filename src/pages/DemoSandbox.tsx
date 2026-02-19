import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Sparkles, Clock, Users, FileText, Calendar, Bot, CheckCircle2, Thermometer, Droplet, Zap, Wrench, ArrowUpDown, Wifi, Loader2 } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { DEMO_FEATURES_CHECKLIST_EXTENDED, getResolvedChecklistItem } from '@/config/demoTourConfig';
import { INDUSTRY_OPTIONS, type IndustryOption } from '@/data/industryDemoData';
import { cn } from '@/lib/utils';

const FEATURE_HIGHLIGHTS = [
  { icon: Calendar, label: 'Smart Scheduling', description: 'Drag & drop calendar' },
  { icon: Users, label: 'Team Management', description: 'Track technicians' },
  { icon: FileText, label: 'Invoicing', description: 'One-click billing' },
  { icon: Bot, label: 'AI Assistant', description: 'Field support' },
];

const industryIcons: Record<string, typeof Thermometer> = {
  hvac: Thermometer,
  plumbing: Droplet,
  electrical: Zap,
  elevator: ArrowUpDown,
  home_automation: Wifi,
  general: Wrench,
};

export default function DemoSandbox() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryOption | null>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const handleIndustrySelect = (industry: IndustryOption) => {
    setSelectedIndustry(industry);
    
    // Auto-scroll to CTA after a brief delay for visual feedback
    setTimeout(() => {
      ctaRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }, 150);
  };

  // Check if returning to existing session
  useEffect(() => {
    const existingToken = searchParams.get('session');
    if (existingToken) {
      // Validate and resume session
      validateAndResumeSession(existingToken);
    }
  }, [searchParams]);

  const validateAndResumeSession = async (token: string) => {
    try {
      // Use security definer function to lookup session by token
      const { data, error } = await supabase.rpc('get_demo_sandbox_session_by_token', {
        p_session_token: token
      });

      if (error || !data || data.length === 0) {
        console.error('Invalid session token');
        return;
      }

      const session = data[0];
      // Check if session is still valid (not expired) - function already filters by expires_at > now()
      if (session) {
        // Resume session - get industry from session data
        const industry = session.industry || 'general';
        navigate(`/demo/dashboard?session=${token}&industry=${industry}`);
      }
    } catch (err) {
      console.error('Failed to validate session:', err);
    }
  };

  const startDemo = async () => {
    if (!selectedIndustry) return;
    
    console.log('[DemoSandbox] Starting demo with industry:', selectedIndustry.id);
    setIsLoading(true);
    setError(null);

    try {
      // Create new demo session using RPC function (bypasses RLS for anonymous users)
      const { data, error: rpcError } = await supabase.rpc(
        'create_demo_sandbox_session',
        { p_industry: selectedIndustry.id }
      );

      if (rpcError) {
        console.error('[DemoSandbox] Session creation failed:', rpcError);
        throw rpcError;
      }

      console.log('[DemoSandbox] Session created, navigating to dashboard');
      // Navigate to demo dashboard with session token (RPC returns token directly)
      navigate(`/demo/dashboard?session=${data}`);
    } catch (err) {
      console.error('[DemoSandbox] Failed to start demo:', err);
      setError('Failed to start demo. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Helmet>
        <title>Interactive Demo — FieldTek AI | Try It Free</title>
        <meta name="description" content="Experience FieldTek AI's field service management platform with realistic sample data. No signup required — explore scheduling, invoicing, AI assistant, and more." />
        <link rel="canonical" href="https://fieldtek.ai/demo-sandbox" />
        <meta property="og:title" content="Interactive Demo — FieldTek AI" />
        <meta property="og:description" content="Try FieldTek AI free — no signup required. Explore scheduling, invoicing, and AI-powered field service tools." />
        <meta property="og:url" content="https://fieldtek.ai/demo-sandbox" />
      </Helmet>
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8 sm:mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6">
              <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
              Interactive Demo
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 px-2">
              Experience FieldTek in Action
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
              Explore our field service management platform with realistic sample data. 
              No signup required – just click and start exploring.
            </p>
          </motion.div>

          {/* Industry Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 sm:mb-12"
          >
            <h2 className="text-lg sm:text-xl font-semibold text-center mb-4 sm:mb-6">
              Choose Your Industry
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              {INDUSTRY_OPTIONS.map((industry) => {
                const IconComponent = industryIcons[industry.id];
                const isSelected = selectedIndustry?.id === industry.id;
                
                return (
                  <Card 
                    key={industry.id}
                    data-testid={`industry-card-${industry.id}`}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      isSelected && "ring-2 ring-primary border-primary bg-primary/5"
                    )}
                    onClick={() => handleIndustrySelect(industry)}
                  >
                    <CardContent className="p-3 sm:pt-6 sm:p-6 text-center">
                      <div className={cn(
                        "w-10 h-10 sm:w-12 sm:h-12 rounded-full mx-auto mb-2 sm:mb-3 flex items-center justify-center transition-colors",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        <IconComponent className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <h3 className="font-semibold text-sm sm:text-base mb-0.5 sm:mb-1">{industry.name}</h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">{industry.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </motion.div>

          {/* Feature Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-8 sm:mb-12"
          >
            {FEATURE_HIGHLIGHTS.map((feature) => (
              <Card key={feature.label} className="text-center">
                <CardContent className="p-3 sm:pt-6 sm:p-6">
                  <feature.icon className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 sm:mb-3 text-primary" />
                  <h3 className="font-semibold text-sm sm:text-base mb-0.5 sm:mb-1">{feature.label}</h3>
                  <p className="text-[10px] sm:text-sm text-muted-foreground line-clamp-2">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* Start Demo CTA */}
          <motion.div
            ref={ctaRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center mb-12"
          >
            <Card className="max-w-md mx-auto">
              <CardContent className="pt-8 pb-8">
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">2-hour demo session</span>
                </div>
                
                <Button
                  size="lg"
                  className="w-full text-lg h-14 mb-4"
                  onClick={startDemo}
                  disabled={isLoading || !selectedIndustry}
                  data-testid="start-demo-button"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" data-testid="demo-loading-spinner" />
                      Loading Demo...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-5 w-5" />
                      Start Exploring
                    </>
                  )}
                </Button>

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20" data-testid="demo-error-container">
                    <p className="text-sm text-destructive font-medium" data-testid="demo-error-message">{error}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={startDemo}
                      data-testid="demo-retry-button"
                    >
                      Try Again
                    </Button>
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  {selectedIndustry 
                    ? `You'll explore as the owner of "${selectedIndustry.companyName}" with industry-specific sample data.`
                    : 'Select an industry above to see relevant sample data in the demo.'}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* What You'll Explore */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-xl sm:text-2xl font-semibold text-center mb-4 sm:mb-6">
              What You'll Explore
            </h2>
            <div className="grid sm:grid-cols-2 gap-2 sm:gap-4">
              {DEMO_FEATURES_CHECKLIST_EXTENDED
                .filter(item => item.category === 'core') // Show only core items on landing
                .map((feature) => {
                  const resolved = getResolvedChecklistItem(feature, selectedIndustry?.id || 'general');
                  return (
                    <div
                      key={feature.id}
                      className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border bg-card"
                    >
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm sm:text-base">{resolved.label}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">{resolved.description}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            Ready to get started for real?{' '}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/register')}>
              Join our waitlist
            </Button>
          </p>
        </div>
      </footer>
    </div>
  );
}
