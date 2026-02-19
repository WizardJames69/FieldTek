import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  X,
  CheckCircle2,
  Palette,
  UserPlus,
  CalendarDays
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { motion, AnimatePresence } from 'framer-motion';

interface PostCheckoutNudgeProps {
  onDismiss?: () => void;
}

export function PostCheckoutNudge({ onDismiss }: PostCheckoutNudgeProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  const { progress, isLoading, completionPercentage } = useOnboardingProgress();

  // Check if user just came from checkout (has ?from=checkout param)
  const fromCheckout = searchParams.get('from') === 'checkout';

  // Clear the param after showing the nudge
  useEffect(() => {
    if (fromCheckout) {
      const timeout = setTimeout(() => {
        searchParams.delete('from');
        setSearchParams(searchParams, { replace: true });
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [fromCheckout, searchParams, setSearchParams]);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  // Don't show if:
  // - Still loading
  // - Not from checkout
  // - Already dismissed
  // - Onboarding is 100% complete
  // - Progress not available
  if (isLoading || !fromCheckout || dismissed || !progress || completionPercentage === 100) {
    return null;
  }

  // Determine next recommended action
  const getNextAction = () => {
    if (!progress.branding_completed) {
      return {
        label: 'Customize branding',
        description: 'Upload your logo and set brand colors',
        icon: Palette,
        action: () => navigate('/settings?tab=branding'),
      };
    }
    if (!progress.first_client_added) {
      return {
        label: 'Add first customer',
        description: 'Create a customer profile',
        icon: UserPlus,
        action: () => navigate('/clients'),
      };
    }
    if (!progress.first_job_created) {
      return {
        label: 'Schedule first job',
        description: 'Create and assign a service job',
        icon: CalendarDays,
        action: () => navigate('/jobs'),
      };
    }
    return null;
  };

  const nextAction = getNextAction();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <Card className="relative overflow-hidden border-success/30 bg-gradient-to-r from-success/10 via-accent/5 to-primary/5">
          {/* Decorative background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-success/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/10 rounded-full blur-3xl" />
          </div>

          <CardContent className="relative p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                {/* Success icon */}
                <div className="flex-shrink-0 p-3 rounded-full bg-success/20">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>

                <div className="space-y-3">
                  {/* Header */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-foreground">
                        🎉 Welcome to your new subscription!
                      </h3>
                      <Badge variant="secondary" className="bg-success/20 text-success border-success/30">
                        Active
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Your payment was successful. Complete a few more steps to get the most out of FieldTek.
                    </p>
                  </div>

                  {/* Next action card */}
                  {nextAction && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="inline-flex items-center gap-3 p-3 rounded-lg bg-background/60 border border-border/50"
                    >
                      <div className="p-2 rounded-lg bg-accent/10">
                        <nextAction.icon className="h-4 w-4 text-accent" />
                      </div>
                      <div className="mr-4">
                        <p className="text-sm font-medium">{nextAction.label}</p>
                        <p className="text-xs text-muted-foreground">{nextAction.description}</p>
                      </div>
                      <Button 
                        size="sm" 
                        className="gap-1 bg-accent hover:bg-accent/90"
                        onClick={nextAction.action}
                      >
                        Start
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </motion.div>
                  )}

                  {/* Progress indicator */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                    <span>
                      Setup {completionPercentage}% complete
                    </span>
                  </div>
                </div>
              </div>

              {/* Dismiss button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
