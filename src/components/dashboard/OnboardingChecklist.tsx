import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { 
  Check, 
  Building2, 
  Palette, 
  Users, 
  UserPlus, 
  FileText,
  ChevronRight,
  Sparkles,
  X,
  CreditCard,
  CalendarDays,
  FolderUp,
  Inbox
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  completed: boolean;
  action: () => void;
  actionLabel: string;
}

interface OnboardingChecklistProps {
  onDismiss?: () => void;
}

export function OnboardingChecklist({ onDismiss }: OnboardingChecklistProps) {
  const navigate = useNavigate();
  const { progress, isLoading, completionPercentage, completedSteps, totalSteps, updateProgress } = useOnboardingProgress();
  const hasTriggeredConfetti = useRef(false);

  // Trigger confetti when all steps are completed
  useEffect(() => {
    if (completionPercentage === 100 && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true;
      
      // Fire multiple bursts for a more celebratory effect
      const duration = 3000;
      const end = Date.now() + duration;

      const fireConfetti = () => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f97316', '#fb923c', '#fdba74', '#22c55e', '#86efac']
        });

        if (Date.now() < end) {
          requestAnimationFrame(fireConfetti);
        }
      };

      // Initial burst
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#f97316', '#fb923c', '#fdba74', '#22c55e', '#86efac']
      });

      // Side cannons
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#f97316', '#fb923c', '#fdba74']
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#22c55e', '#86efac', '#f97316']
        });
      }, 200);
    }
  }, [completionPercentage]);

  if (isLoading || !progress) {
    return null;
  }

  // If all steps are completed or explicitly dismissed, don't show the checklist
  if (progress.onboarding_completed) {
    return null;
  }

  // Company info is always completed if user reached dashboard (they went through onboarding)
  const effectiveCompanyInfoCompleted = true;

  const checklistItems: ChecklistItem[] = [
    {
      id: 'company_info',
      label: 'Complete company profile',
      description: 'Add your business address, phone, and contact details',
      icon: Building2,
      completed: effectiveCompanyInfoCompleted,
      action: () => navigate('/settings'),
      actionLabel: 'Edit Profile',
    },
    {
      id: 'branding',
      label: 'Customize your branding',
      description: 'Upload your logo and set brand colors for a professional look',
      icon: Palette,
      completed: progress.branding_completed,
      action: () => navigate('/settings?tab=branding'),
      actionLabel: 'Add Branding',
    },
    {
      id: 'first_client',
      label: 'Add your first customer',
      description: 'Create a customer profile with their contact and service address',
      icon: UserPlus,
      completed: progress.first_client_added,
      action: () => navigate('/clients'),
      actionLabel: 'Add Customer',
    },
    {
      id: 'first_job',
      label: 'Schedule your first job',
      description: 'Create a service job and assign it to your calendar',
      icon: CalendarDays,
      completed: progress.first_job_created,
      action: () => navigate('/jobs'),
      actionLabel: 'Schedule Job',
    },
    {
      id: 'team_member',
      label: 'Invite your team',
      description: 'Add technicians, dispatchers, or admins to your organization',
      icon: Users,
      completed: progress.first_team_member_invited,
      action: () => navigate('/team'),
      actionLabel: 'Invite Team',
    },
    {
      id: 'first_invoice',
      label: 'Create your first invoice',
      description: 'Generate and send a professional invoice to a customer',
      icon: FileText,
      completed: progress.first_invoice_created,
      action: () => navigate('/invoices'),
      actionLabel: 'Create Invoice',
    },
    {
      id: 'first_document',
      label: 'Upload a document',
      description: 'Store contracts, warranties, or equipment manuals',
      icon: FolderUp,
      completed: progress.first_document_uploaded,
      action: () => navigate('/documents'),
      actionLabel: 'Upload Document',
    },
    {
      id: 'service_request',
      label: 'Receive a service request',
      description: 'Share your portal link so customers can submit requests',
      icon: Inbox,
      completed: progress.first_service_request_received,
      action: () => navigate('/requests'),
      actionLabel: 'View Requests',
    },
    {
      id: 'stripe_connect',
      label: 'Connect payments',
      description: 'Enable Stripe to accept online payments from customers',
      icon: CreditCard,
      completed: progress.stripe_connect_completed,
      action: () => navigate('/settings?tab=billing'),
      actionLabel: 'Connect Stripe',
    },
  ];

  const nextIncompleteItem = checklistItems.find(item => !item.completed);

  const handleDismiss = async () => {
    await updateProgress({ onboarding_completed: true });
    onDismiss?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-accent/30 bg-gradient-to-br from-accent/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-accent/10">
                <Sparkles className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Get started with FieldTek</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Complete these steps to set up your account
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{completedSteps} of {totalSteps} completed</span>
              <span className="font-medium text-accent">{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-2">
            <AnimatePresence>
              {checklistItems.map((item, index) => {
                const Icon = item.icon;
                const isNext = item === nextIncompleteItem;
                
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg transition-all',
                      item.completed 
                        ? 'bg-success/5 text-muted-foreground' 
                        : isNext 
                          ? 'bg-accent/10 border border-accent/30' 
                          : 'bg-muted/30 hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        item.completed 
                          ? 'bg-success text-success-foreground' 
                          : isNext 
                            ? 'bg-accent text-accent-foreground'
                            : 'bg-muted text-muted-foreground'
                      )}>
                        {item.completed ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className={cn(
                          'font-medium text-sm',
                          item.completed && 'line-through opacity-60'
                        )}>
                          {item.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    
                    {!item.completed && (
                      <Button 
                        size="sm" 
                        variant={isNext ? 'default' : 'ghost'}
                        className={cn(
                          'gap-1',
                          isNext && 'bg-accent hover:bg-accent/90'
                        )}
                        onClick={item.action}
                      >
                        {item.actionLabel}
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          
          {completionPercentage === 100 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 p-4 rounded-lg bg-success/10 border border-success/20 text-center"
            >
              <p className="font-medium text-success">🎉 All set up! You're ready to go.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={handleDismiss}
              >
                Dismiss checklist
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
