import { useNavigate } from 'react-router-dom';
import { 
  Check, 
  ChevronRight, 
  Building2, 
  Palette, 
  UserPlus, 
  CalendarDays, 
  Users, 
  FileText,
  Rocket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import type { OnboardingProgress } from '@/hooks/useOnboardingProgress';

interface PostCheckoutWizardProps {
  progress: OnboardingProgress;
  tier: string | null;
  onSkip: () => void;
}

const setupSteps = [
  {
    id: 'branding',
    field: 'branding_completed',
    label: 'Customize branding',
    description: 'Add your logo and brand colors',
    icon: Palette,
    route: '/settings?tab=branding',
  },
  {
    id: 'first_client',
    field: 'first_client_added',
    label: 'Add your first customer',
    description: 'Create a customer profile',
    icon: UserPlus,
    route: '/clients',
  },
  {
    id: 'first_job',
    field: 'first_job_created',
    label: 'Schedule a job',
    description: 'Create your first service job',
    icon: CalendarDays,
    route: '/jobs',
  },
  {
    id: 'team_member',
    field: 'first_team_member_invited',
    label: 'Invite team members',
    description: 'Add technicians or dispatchers',
    icon: Users,
    route: '/team',
  },
  {
    id: 'first_invoice',
    field: 'first_invoice_created',
    label: 'Create an invoice',
    description: 'Send your first invoice',
    icon: FileText,
    route: '/invoices',
  },
] as const;

export function PostCheckoutWizard({ progress, tier, onSkip }: PostCheckoutWizardProps) {
  const navigate = useNavigate();

  const incompleteSteps = setupSteps.filter(
    (step) => !progress[step.field as keyof OnboardingProgress]
  );
  const completedCount = setupSteps.length - incompleteSteps.length;
  const completionPct = Math.round((completedCount / setupSteps.length) * 100);

  const nextStep = incompleteSteps[0];

  if (incompleteSteps.length === 0) {
    // All setup complete – encourage going to dashboard
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-success/30 bg-success/5 p-6 text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/20">
          <Rocket className="h-7 w-7 text-success" />
        </div>
        <h3 className="text-lg font-semibold">You're all set!</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your workspace is fully configured. Start managing jobs!
        </p>
        <Button className="mt-4" onClick={() => navigate('/dashboard')}>
          Go to Dashboard
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/5 to-transparent p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
          <Building2 className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h3 className="font-semibold">Continue setting up your workspace</h3>
          <p className="text-sm text-muted-foreground">
            {tier && (
              <span className="capitalize">{tier} plan activated • </span>
            )}
            {incompleteSteps.length} step{incompleteSteps.length > 1 ? 's' : ''} remaining
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-5 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{completedCount} of {setupSteps.length} completed</span>
          <span className="font-medium text-accent">{completionPct}%</span>
        </div>
        <Progress value={completionPct} className="h-2" />
      </div>

      {/* Steps list */}
      <div className="space-y-2">
        {setupSteps.map((step, idx) => {
          const Icon = step.icon;
          const isCompleted = !!progress[step.field as keyof OnboardingProgress];
          const isNext = step === nextStep;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={cn(
                'flex items-center justify-between rounded-lg p-3 transition-all',
                isCompleted
                  ? 'bg-success/5 text-muted-foreground'
                  : isNext
                    ? 'bg-accent/10 border border-accent/30'
                    : 'bg-muted/30'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full',
                    isCompleted
                      ? 'bg-success text-success-foreground'
                      : isNext
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <div>
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isCompleted && 'line-through opacity-60'
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>

              {!isCompleted && (
                <Button
                  size="sm"
                  variant={isNext ? 'default' : 'ghost'}
                  className={cn('gap-1', isNext && 'bg-accent hover:bg-accent/90')}
                  onClick={() => navigate(step.route)}
                >
                  {isNext ? 'Start' : 'Go'}
                  <ChevronRight className="h-3 w-3" />
                </Button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Skip option */}
      <div className="mt-5 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip for now
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
          Go to Dashboard
        </Button>
      </div>
    </motion.div>
  );
}
