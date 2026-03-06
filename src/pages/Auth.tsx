import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getPostLoginDestination } from '@/lib/authRouting';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { BetaTesterModal } from '@/components/landing/BetaTesterModal';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [betaModalOpen, setBetaModalOpen] = useState(false);

  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if already signed in on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      if (authLoading) return;

      if (user) {
        // User is already signed in, determine where to send them
        const { destination } = await getPostLoginDestination();
        navigate(destination, { replace: true });
        return;
      }

      setIsCheckingSession(false);
    };

    checkExistingSession();
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    console.log('[Auth] Sign-in attempt, email length:', email.length);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      console.log('[Auth] Validation failed:', fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      console.log('[Auth] Calling signIn...');
      const { error } = await signIn(email, password);

      if (error) {
        console.error('[Auth] Sign-in error:', error.message);
        toast({
          variant: 'destructive',
          title: 'Sign in failed',
          description: error.message || 'Invalid email or password',
        });
        return;
      }

      console.log('[Auth] Sign-in successful, determining destination...');
      // Determine where to navigate using centralized routing
      const { destination, error: routingError } = await getPostLoginDestination();
      console.log('[Auth] Destination:', destination, routingError ? `(error: ${routingError})` : '');

      if (routingError) {
        console.warn('[Auth] Routing determination had an error:', routingError);
        // Still navigate, the destination page will handle further redirects
      }

      navigate(destination, { replace: true });
    } catch (err) {
      console.error('[Auth] Unexpected error:', err);
      toast({
        variant: 'destructive',
        title: 'Sign in failed',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking session
  if (isCheckingSession || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08090A]">
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-8">
        {/* Logo + heading */}
        <div className="text-center">
          <div className="mb-4">
            <span className="font-display text-2xl font-bold text-white">Field</span>
            <span className="font-display text-2xl font-bold text-orange-500">Tek</span>
            <span className="ml-2 inline-flex items-center bg-orange-500/10 text-orange-500 text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full">
              Beta
            </span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">Welcome back</h1>
          <p className="mt-2 text-sm text-zinc-500">Sign in to your account to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5" data-testid="auth-login-form">
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
                className={cn('pl-10 h-11 rounded-[10px]', errors.email && 'border-red-500')}
                disabled={isLoading}
                data-testid="auth-email-input"
              />
            </div>
            {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-zinc-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={cn('pl-10 pr-10 h-11 rounded-[10px]', errors.password && 'border-red-500')}
                disabled={isLoading}
                data-testid="auth-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm text-orange-500 hover:text-orange-400 transition-colors"
                onClick={() => navigate('/forgot-password')}
              >
                Forgot password?
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-11 rounded-[10px] bg-orange-500 hover:bg-orange-600 text-white font-semibold cta-glow"
            disabled={isLoading}
            data-testid="auth-submit-button"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <div className="text-center space-y-2">
          <p className="text-zinc-500 text-sm">
            Have a beta access code?{' '}
            <button
              className="text-orange-500 hover:text-orange-400 transition-colors"
              onClick={() => navigate('/register')}
            >
              Register here
            </button>
          </p>
          <p className="text-zinc-500 text-sm">
            Don't have an account?{' '}
            <button
              className="text-orange-500 hover:text-orange-400 transition-colors"
              onClick={() => setBetaModalOpen(true)}
            >
              Apply for beta access
            </button>
          </p>
        </div>
      </div>
      <BetaTesterModal open={betaModalOpen} onOpenChange={setBetaModalOpen} />
    </AuthLayout>
  );
}
