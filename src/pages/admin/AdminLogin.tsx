import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { checkIsPlatformAdmin } from '@/lib/authRouting';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if already signed in as admin on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user) {
          const result = await checkIsPlatformAdmin();
          if (result.isAdmin) {
            navigate('/admin', { replace: true });
            return;
          }
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkExistingSession();
  }, [navigate]);

  const handleRetryAdminCheck = async () => {
    setIsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast({
          variant: 'destructive',
          title: 'Not signed in',
          description: 'Please sign in first.',
        });
        return;
      }

      const result = await checkIsPlatformAdmin();
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Admin check failed',
          description: result.error,
        });
        return;
      }

      if (result.isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        toast({
          variant: 'destructive',
          title: 'Access denied',
          description: 'You are not a platform administrator.',
        });
      }
    } catch (err) {
      console.error('Retry admin check error:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to verify admin status. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    console.log('[AdminLogin] Sign-in attempt for:', email);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      console.log('[AdminLogin] Validation failed:', fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      // Sign in
      console.log('[AdminLogin] Calling signInWithPassword...');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('[AdminLogin] Sign-in error:', signInError.message);
        toast({
          variant: 'destructive',
          title: 'Sign in failed',
          description: signInError.message || 'Invalid email or password',
        });
        return;
      }

      console.log('[AdminLogin] Sign-in successful, checking session...');
      
      // Ensure we have a session before checking admin status
      if (!signInData?.session) {
        console.error('[AdminLogin] No session established');
        toast({
          variant: 'destructive',
          title: 'Sign in failed',
          description: 'Failed to establish session. Please try again.',
        });
        return;
      }

      // Check if user is a platform admin with timeout
      console.log('[AdminLogin] Checking platform admin status...');
      const adminResult = await checkIsPlatformAdmin();
      console.log('[AdminLogin] Admin check result:', adminResult);

      if (adminResult.error) {
        console.error('[AdminLogin] Admin verification error:', adminResult.error);
        // Don't sign out - let them retry
        toast({
          variant: 'destructive',
          title: 'Admin verification failed',
          description: `${adminResult.error}. Click "Retry Admin Check" below.`,
        });
        return;
      }

      if (!adminResult.isAdmin) {
        console.log('[AdminLogin] User is not an admin, signing out...');
        // Sign them out if not a platform admin
        await supabase.auth.signOut();
        toast({
          variant: 'destructive',
          title: 'Access denied',
          description: 'This login is for platform administrators only.',
        });
        return;
      }

      // Success - navigate directly to admin dashboard
      console.log('[AdminLogin] Admin verified, navigating to /admin');
      navigate('/admin', { replace: true });
    } catch (err) {
      console.error('[AdminLogin] Unexpected error:', err);
      toast({
        variant: 'destructive',
        title: 'Sign in failed',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Checking session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-8 bg-card border border-border rounded-2xl shadow-xl p-8 animate-fade-up">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Platform Admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access the admin dashboard
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                className={cn('pl-10', errors.email && 'border-destructive')}
                autoComplete="email"
                disabled={isLoading}
                data-testid="admin-login-email"
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
                autoComplete="current-password"
                disabled={isLoading}
                data-testid="admin-login-password"
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
          </div>

          <Button type="submit" className="w-full gap-2" disabled={isLoading} data-testid="admin-login-submit">
            {isLoading ? 'Signing in...' : 'Sign in to Admin'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        {/* Retry button for stuck states */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetryAdminCheck}
            disabled={isLoading}
            className="text-xs gap-1.5 text-muted-foreground"
          >
            <RefreshCw className="h-3 w-3" />
            Already signed in? Retry admin check
          </Button>
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Not an admin?{' '}
            <Button
              variant="link"
              className="p-0 h-auto text-xs text-accent"
              onClick={() => navigate('/auth')}
            >
              Go to regular login
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
}
