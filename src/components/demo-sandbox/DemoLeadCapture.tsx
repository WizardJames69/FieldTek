import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Rocket, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDemoSandbox } from '@/contexts/DemoSandboxContext';

const FEATURES_THRESHOLD = 3; // Show after exploring 3 features

export function DemoLeadCaptureModal() {
  const navigate = useNavigate();
  const { featuresExplored, captureLeadInfo, checklistProgress } = useDemoSandbox();
  const [isOpen, setIsOpen] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  // Show modal after exploring threshold features
  useEffect(() => {
    if (featuresExplored.length >= FEATURES_THRESHOLD && !hasShown) {
      // Small delay before showing
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasShown(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [featuresExplored.length, hasShown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      await captureLeadInfo(email, name);
      setShowThankYou(true);
      setTimeout(() => {
        setIsOpen(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to capture lead:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinWaitlist = () => {
    setIsOpen(false);
    navigate('/register');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <AnimatePresence mode="wait">
          {showThankYou ? (
            <motion.div
              key="thank-you"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Thanks!</h3>
              <p className="text-muted-foreground">
                We'll be in touch with more information about FieldTek.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DialogHeader>
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    {Math.round(checklistProgress)}% explored
                  </span>
                </div>
                <DialogTitle>Enjoying the Demo?</DialogTitle>
                <DialogDescription>
                  Get a personalized walkthrough or join our waitlist for early access.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Quick action buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-auto py-4 flex-col"
                    onClick={() => setIsOpen(false)}
                  >
                    <span className="text-sm font-medium">Keep Exploring</span>
                    <span className="text-xs text-muted-foreground">Continue the demo</span>
                  </Button>
                  <Button
                    className="h-auto py-4 flex-col"
                    onClick={handleJoinWaitlist}
                  >
                    <Rocket className="h-4 w-4 mb-1" />
                    <span className="text-sm font-medium">Join Waitlist</span>
                    <span className="text-xs opacity-80">Get early access</span>
                  </Button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      or get more info
                    </span>
                  </div>
                </div>

                {/* Email capture form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="demo-name">Name (optional)</Label>
                    <Input
                      id="demo-name"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="demo-email">Email</Label>
                    <Input
                      id="demo-email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="secondary"
                    className="w-full"
                    disabled={isSubmitting || !email}
                  >
                    {isSubmitting ? 'Sending...' : 'Send Me Info'}
                  </Button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
