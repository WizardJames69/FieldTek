import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Mail, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { AuthLayout } from '@/components/auth/AuthLayout';

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

const RATE_LIMIT_MS = 60000;
const RATE_LIMIT_KEY = 'forgotPasswordLastRequest';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [lastRequestTime, setLastRequestTime] = useState(() => {
    const stored = sessionStorage.getItem(RATE_LIMIT_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

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
      <AuthLayout>
        <div className="space-y-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10 mb-2">
            <CheckCircle className="h-8 w-8 text-orange-500" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">Check your email</h1>
          <p className="text-zinc-500">
            We've sent a password reset link to <strong className="text-zinc-300">{email}</strong>. Click the link in the email to reset your password.
          </p>
          <div className="pt-2 space-y-3">
            <Button
              className="w-full h-11 rounded-[10px] bg-transparent border border-white/[0.1] text-white hover:bg-white/5"
              onClick={() => navigate('/auth')}
            >
              Back to sign in
            </Button>
            <p className="text-sm text-zinc-500">
              Didn't receive the email?{' '}
              <button
                className="text-orange-500 hover:text-orange-400 transition-colors"
                onClick={() => setIsSuccess(false)}
              >
                Try again
              </button>
            </p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="space-y-8">
        <div className="text-center">
          <div className="mb-4">
            <span className="font-display text-2xl font-bold text-white">Field</span>
            <span className="font-display text-2xl font-bold text-orange-500">Tek</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">Forgot password?</h1>
          <p className="mt-2 text-sm text-zinc-500">
            No worries, we'll send you reset instructions.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-zinc-300">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={cn('pl-10 h-11 rounded-[10px]', error && 'border-red-500')}
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          <Button
            type="submit"
            className="w-full h-11 rounded-[10px] bg-orange-500 hover:bg-orange-600 text-white font-semibold cta-glow"
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Send reset link'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <div className="text-center">
          <button
            className="flex items-center gap-2 mx-auto text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            onClick={() => navigate('/auth')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
