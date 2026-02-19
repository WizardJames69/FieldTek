import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { getPostLoginDestination } from '@/lib/authRouting';

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Back Button */}
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
          {/* Logo */}
          <div className="text-center">
            <div className="mb-4">
              <Logo size="lg" asLink={false} />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">Welcome back</h1>
            <p className="mt-2 text-muted-foreground">Sign in to your account to continue</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6" data-testid="auth-login-form">
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
                  className={cn('pl-10', errors.email && 'border-destructive')}
                  disabled={isLoading}
                  data-testid="auth-email-input"
                />
              </div>
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn('pl-10 pr-10', errors.password && 'border-destructive')}
                  disabled={isLoading}
                  data-testid="auth-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto text-sm text-muted-foreground hover:text-accent"
                  onClick={() => navigate('/forgot-password')}
                >
                  Forgot password?
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full gap-2" disabled={isLoading} data-testid="auth-submit-button">
              {isLoading ? 'Signing in...' : 'Sign in'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="text-center space-y-2">
            <p className="text-muted-foreground text-sm">
              Have a beta access code?{' '}
              <Button
                variant="link"
                className="p-0 h-auto text-sm text-accent"
                onClick={() => navigate('/register')}
              >
                Register here
              </Button>
            </p>
            <p className="text-muted-foreground text-sm">
              Don't have an account?{' '}
              <Button
                variant="link"
                className="p-0 h-auto text-sm text-accent"
                onClick={() => navigate('/#beta-program')}
              >
                Apply for beta access
              </Button>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Branding */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-primary p-12">
        <div className="max-w-lg text-center text-primary-foreground space-y-6 animate-fade-in">
          <h2 className="font-display text-4xl font-bold">
            Field Service Management, Simplified
          </h2>
          <p className="text-lg text-primary-foreground/80">
            AI-powered platform for trade businesses. Dispatch jobs, track technicians, manage invoices, and delight customers—all in one place.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-8">
            <div className="bg-primary-foreground/10 rounded-xl p-4">
              <p className="text-3xl font-bold">95%</p>
              <p className="text-sm text-primary-foreground/70">Faster Dispatch</p>
            </div>
            <div className="bg-primary-foreground/10 rounded-xl p-4">
              <p className="text-3xl font-bold">2x</p>
              <p className="text-sm text-primary-foreground/70">More Jobs/Day</p>
            </div>
            <div className="bg-primary-foreground/10 rounded-xl p-4">
              <p className="text-3xl font-bold">50%</p>
              <p className="text-sm text-primary-foreground/70">Less Paperwork</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
