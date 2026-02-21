import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clipboard,
  MessageSquare,
  Bell,
  Check,
  ArrowRight,
  ArrowLeft,
  Zap,
  Bot,
  Volume2,
  FileText,
  Calendar,
  CheckCircle2,
  MapPin,
  Loader2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface TechnicianTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

const steps = [
  { id: 'jobs', title: 'Your Jobs', icon: Clipboard },
  { id: 'assistant', title: 'AI Assistant', icon: MessageSquare },
  { id: 'notifications', title: 'Notifications', icon: Bell },
] as const;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
  }),
};

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <Card className="bg-muted/30 border-border/50">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function JobsStep() {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Clipboard className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">View & Manage Your Jobs</h2>
        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
          All your assigned jobs are organized in one place. See what's next, update progress, and get directions.
        </p>
      </div>
      <div className="space-y-3">
        <FeatureCard
          icon={Calendar}
          title="Today's Jobs"
          description="See what's scheduled and start your next job with one tap"
        />
        <FeatureCard
          icon={CheckCircle2}
          title="Update Status"
          description="Mark jobs as started or completed right from the field"
        />
        <FeatureCard
          icon={MapPin}
          title="Navigation & Details"
          description="Get directions, call clients, and view job checklists"
        />
      </div>
    </div>
  );
}

function AssistantStep() {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Your AI Field Assistant</h2>
        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
          Get instant help while on the job. Ask troubleshooting questions and reference your company's documentation.
        </p>
      </div>
      <div className="space-y-3">
        <FeatureCard
          icon={Bot}
          title="Ask Anything"
          description="Get answers about repairs, codes, and procedures"
        />
        <FeatureCard
          icon={Volume2}
          title="Voice Input"
          description="Speak your questions hands-free while working"
        />
        <FeatureCard
          icon={FileText}
          title="Document-Backed"
          description="Answers cite your company's uploaded manuals and specs"
        />
      </div>
    </div>
  );
}

function NotificationsStep() {
  const { isSupported, isSubscribed, permission, subscribe, isSubscribing } =
    usePushNotifications();

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Bell className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Never Miss a Job Update</h2>
        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
          Enable push notifications to get instant alerts when new jobs are assigned or schedules change.
        </p>
      </div>

      <div className="pt-2">
        {isSubscribed ? (
          <Card className="border-success/30 bg-success/5">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="font-semibold text-success">Notifications Enabled!</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  You'll receive alerts for new jobs and schedule changes.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : !isSupported ? (
          <Card className="border-border/50 bg-muted/30">
            <CardContent className="flex items-center gap-3 p-5">
              <Info className="h-6 w-6 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium">Not Available</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Push notifications aren't supported on this browser. You can still check your dashboard for updates.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : permission === 'denied' ? (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="flex items-center gap-3 p-5">
              <AlertTriangle className="h-6 w-6 text-warning shrink-0" />
              <div>
                <p className="font-medium">Notifications Blocked</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Notifications are blocked in your browser settings. You can enable them later from your browser's site settings.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button
            className="w-full h-14 text-base gap-2"
            size="lg"
            onClick={() => subscribe()}
            disabled={isSubscribing}
          >
            {isSubscribing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Enabling...
              </>
            ) : (
              <>
                <Bell className="h-5 w-5" />
                Enable Push Notifications
              </>
            )}
          </Button>
        )}

        {!isSubscribed && isSupported && permission !== 'denied' && (
          <p className="text-xs text-center text-muted-foreground mt-3">
            You can always enable this later in your browser settings.
          </p>
        )}
      </div>
    </div>
  );
}

export function TechnicianTutorial({ onComplete, onSkip }: TechnicianTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setDirection(1);
      setCurrentStep((s) => s + 1);
    } else {
      onComplete();
    }
  };

  const goBack = () => {
    setDirection(-1);
    setCurrentStep((s) => s - 1);
  };

  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] max-w-lg mx-auto">
      {/* Step Indicator */}
      <div className="py-6 px-2">
        <div className="flex items-center justify-center">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = currentStep > index;
            const isCurrent = currentStep === index;

            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
                      isCompleted
                        ? 'bg-success text-success-foreground'
                        : isCurrent
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs mt-2 font-medium',
                      isCurrent ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'w-12 sm:w-16 h-0.5 mx-2 mb-5 transition-colors duration-300',
                      isCompleted ? 'bg-success' : 'bg-border'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {currentStep === 0 && <JobsStep />}
            {currentStep === 1 && <AssistantStep />}
            {currentStep === 2 && <NotificationsStep />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-border p-4 bg-background">
        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tutorial
          </button>
          <div className="flex gap-3">
            {currentStep > 0 && (
              <Button variant="outline" onClick={goBack} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            <Button onClick={goNext} className="gap-1.5">
              {isLastStep ? (
                <>
                  Get Started
                  <Zap className="h-4 w-4" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
