import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Mail, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

const RATE_LIMIT_MS = 60000; // 1 minute between requests
const RATE_LIMIT_KEY = 'forgotPasswordLastRequest';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | undefined>();
  // Initialize from sessionStorage to persist across page refreshes
  const [lastRequestTime, setLastRequestTime] = useState(() => {
    const stored = sessionStorage.getItem(RATE_LIMIT_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    // Rate limiting check
    const now = Date.now();
    if (now - lastRequestTime < RATE_LIMIT_MS) {
      const secondsRemaining = Math.ceil((RATE_LIMIT_MS - (now - lastRequestTime)) / 1000);
      setError(`Please wait ${secondsRemaining} seconds before requesting another reset.`);
      toast({
        variant: 'destructive',
        title: 'Too many requests',
        description: `Please wait ${secondsRemaining} seconds before trying again.`,
      });
      return;
    }

    const result = emailSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    setLastRequestTime(now);
    // Persist to sessionStorage for rate limiting across refreshes
    sessionStorage.setItem(RATE_LIMIT_KEY, now.toString());
    
    const { data, error: fnError } = await supabase.functions.invoke('send-auth-email', {
      body: {
        email,
        type: 'recovery',
        redirect_to: `${ORIGIN}/reset-password`,
      },
    });

    setIsLoading(false);

    if (fnError || data?.error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send reset email. Please try again.',
      });
    } else {
      setIsSuccess(true);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex">
        <div className="flex-1 flex items-center justify-center p-8 relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="absolute top-6 left-6 gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Button>
          <div className="w-full max-w-md space-y-8 animate-fade-up text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">Check your email</h1>
            <p className="text-muted-foreground">
              We've sent a password reset link to <strong>{email}</strong>. Click the link in the email to reset your password.
            </p>
            <div className="pt-4 space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/auth')}
              >
                Back to sign in
              </Button>
              <p className="text-sm text-muted-foreground">
                Didn't receive the email?{' '}
                <Button
                  variant="link"
                  className="p-0 h-auto text-accent"
                  onClick={() => setIsSuccess(false)}
                >
                  Try again
                </Button>
              </p>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex flex-1 items-center justify-center bg-primary p-12">
          <div className="max-w-lg text-center text-primary-foreground space-y-6 animate-fade-in">
            <h2 className="font-display text-4xl font-bold">
              Password Reset
            </h2>
            <p className="text-lg text-primary-foreground/80">
              Check your inbox for the reset link. If you don't see it, check your spam folder.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Button>
        <div className="w-full max-w-md space-y-8 animate-fade-up">
          <div className="text-center">
            <div className="mb-4">
              <Logo size="lg" asLink={false} />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">Forgot password?</h1>
            <p className="mt-2 text-muted-foreground">
              No worries, we'll send you reset instructions.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={cn('pl-10', error && 'border-destructive')}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <Button type="submit" className="w-full gap-2" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send reset link'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="text-center">
            <Button
              variant="link"
              className="gap-2 text-muted-foreground"
              onClick={() => navigate('/auth')}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Button>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center bg-primary p-12">
        <div className="max-w-lg text-center text-primary-foreground space-y-6 animate-fade-in">
          <h2 className="font-display text-4xl font-bold">
            Reset Your Password
          </h2>
          <p className="text-lg text-primary-foreground/80">
            Enter your email and we'll send you a link to reset your password securely.
          </p>
        </div>
      </div>
    </div>
  );
}
