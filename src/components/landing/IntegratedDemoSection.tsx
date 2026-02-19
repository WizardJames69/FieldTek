import { useState, lazy, Suspense, memo, useCallback, Component, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Film, AlertCircle, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { LeadCaptureModal } from './LeadCaptureModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Error Boundary for lazy-loaded components
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class DemoErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[IntegratedDemo] Error loading component:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Lazy load heavy components with timeout
const InteractiveProductDemo = lazy(() => 
  Promise.race([
    import('./InteractiveProductDemo').then(m => ({ default: m.InteractiveProductDemo })),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout loading demo')), 10000)
    )
  ]).catch(err => {
    console.error('[IntegratedDemo] Failed to load InteractiveProductDemo:', err);
    throw err;
  })
);

const ScriptedDemoPlayer = lazy(() => 
  Promise.race([
    import('./ScriptedDemoPlayer').then(m => ({ default: m.ScriptedDemoPlayer })),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout loading demo player')), 10000)
    )
  ]).catch(err => {
    console.error('[IntegratedDemo] Failed to load ScriptedDemoPlayer:', err);
    throw err;
  })
);

// Loading skeleton for demo
function DemoFallback() {
  return (
    <div className="space-y-4 min-h-[300px] sm:min-h-[400px] flex flex-col items-center justify-center">
      <div className="w-full max-w-sm mx-auto space-y-4">
        <Skeleton className="h-40 sm:h-52 rounded-xl" />
        <div className="flex justify-center gap-1.5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-2 w-2 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-6 w-36 mx-auto" />
      </div>
      <p className="text-xs text-muted-foreground animate-pulse">Loading demo...</p>
    </div>
  );
}

// Error fallback with retry
function DemoErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-[300px] sm:min-h-[400px] flex flex-col items-center justify-center text-center p-6">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg mb-2">Demo couldn't load</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
        There was an issue loading the interactive demo. Please try again.
      </p>
      <Button onClick={onRetry} variant="outline" size="sm" className="gap-2">
        <RefreshCw className="w-4 h-4" />
        Try Again
      </Button>
    </div>
  );
}

export const IntegratedDemoSection = memo(function IntegratedDemoSection() {
  const [controlledScene, setControlledScene] = useState<number | undefined>(undefined);
  const [isScriptedPlaying, setIsScriptedPlaying] = useState(false);
  const [demoRunKey, setDemoRunKey] = useState(0);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [demoErrorKey, setDemoErrorKey] = useState(0);
  
  // Retry loading demo on error
  const handleDemoRetry = useCallback(() => {
    setDemoErrorKey(prev => prev + 1);
    setDemoRunKey(prev => prev + 1);
  }, []);

  const handleScriptedSceneChange = (sceneId: number) => {
    console.log('[IntegratedDemo] Scripted scene change:', sceneId);
    setControlledScene(sceneId);
  };

  const handleLeadCapture = useCallback(() => {
    setShowLeadModal(true);
  }, []);

  const handleSessionStart = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
  }, []);

  const handleLeadSubmit = useCallback(async (data: { 
    name: string; 
    email: string; 
    phone?: string; 
    company?: string; 
  }) => {
    // Insert into demo_requests
    const { error: requestError } = await supabase
      .from('demo_requests')
      .insert({
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        company_name: data.company || null,
        status: 'ai_demo_lead',
        pipeline_stage: 'lead',
        message: 'Captured during product demo',
      });

    if (requestError) {
      console.error('Failed to save lead:', requestError);
      toast.error('Failed to save your info. Please try again.');
      throw requestError;
    }

    // Update demo_sessions if we have a session
    if (currentSessionId) {
      await supabase
        .from('demo_sessions')
        .update({ lead_captured: true })
        .eq('id', currentSessionId);
    }

    toast.success('Thanks! We\'ll be in touch soon.');
  }, [currentSessionId]);

  return (
    <section id="demo" className="py-12 md:py-16 px-4 bg-gradient-to-b from-background via-muted/30 to-background overflow-hidden">
      <div className="max-w-6xl mx-auto section-glass p-4 md:p-8">
        {/* Header - More compact */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-2">
            <Sparkles className="w-3 h-3" />
            Product Walkthrough
          </span>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-1">
            See FieldTek in Action
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground max-w-md mx-auto">
            See how FieldTek eliminates callbacks in under 2 minutes
          </p>
        </motion.div>

        {/* Main Content - Mobile-first: visual on top, controls below */}
        <div className="flex flex-col lg:grid lg:grid-cols-5 gap-4 items-start">
          {/* Visual Demo - Shows first on mobile */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="w-full order-1 lg:order-2 lg:col-span-4 min-h-[320px] sm:min-h-[400px]"
          >
            <DemoErrorBoundary 
              key={demoErrorKey}
              fallback={<DemoErrorFallback onRetry={handleDemoRetry} />}
            >
              <Suspense fallback={<DemoFallback />}>
                <InteractiveProductDemo 
                  key={demoRunKey}
                  controlledScene={controlledScene}
                  onSceneChange={(scene) => {
                    setControlledScene(scene);
                  }}
                  embedded={true}
                  disableAutoPlay={isScriptedPlaying}
                  hideControls={false}
                />
              </Suspense>
            </DemoErrorBoundary>
          </motion.div>

          {/* Control Panel - Below visual on mobile, sidebar on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="w-full order-2 lg:order-1 lg:col-span-1 lg:sticky lg:top-20"
          >
            <div className="mb-2 text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-medium text-primary bg-primary/10 px-3 py-1 rounded-full animate-pulse-subtle">
                <Film className="w-3 h-3" />
                Watch the 2-min Tour
              </div>
            </div>
            <DemoErrorBoundary 
              key={demoErrorKey}
              fallback={<DemoErrorFallback onRetry={handleDemoRetry} />}
            >
              <Suspense fallback={<DemoFallback />}>
                <ScriptedDemoPlayer 
                  onSceneChange={handleScriptedSceneChange}
                  onPlayingChange={(playing) => {
                    setIsScriptedPlaying(playing);
                    if (playing) {
                      setDemoRunKey((k) => k + 1);
                    }
                  }}
                  compact
                />
              </Suspense>
            </DemoErrorBoundary>
          </motion.div>
        </div>

        {/* Lead Capture Modal */}
        <LeadCaptureModal
          open={showLeadModal}
          onOpenChange={setShowLeadModal}
          onSubmit={handleLeadSubmit}
        />
      </div>
    </section>
  );
});

export default IntegratedDemoSection;
