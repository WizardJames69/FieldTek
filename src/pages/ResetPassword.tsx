import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Building2, Lock, Eye, EyeOff, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const passwordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user arrived via password reset link
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
      } else if (session) {
        setIsValidSession(true);
      }
    });

    // Also check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsValidSession(true);
      } else {
        setIsValidSession(false);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = passwordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const fieldErrors: { password?: string; confirmPassword?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'password') fieldErrors.password = err.message;
        if (err.path[0] === 'confirmPassword') fieldErrors.confirmPassword = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    
    const { error } = await supabase.auth.updateUser({ password });
    
    setIsLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to reset password',
      });
    } else {
      setIsSuccess(true);
      // Sign out after password reset
      await supabase.auth.signOut();
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
            <h1 className="font-display text-3xl font-bold text-foreground">Password reset successful</h1>
            <p className="text-muted-foreground">
              Your password has been successfully reset. You can now sign in with your new password.
            </p>
            <Button
              className="w-full gap-2"
              onClick={() => navigate('/auth')}
            >
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="hidden lg:flex flex-1 items-center justify-center bg-primary p-12">
          <div className="max-w-lg text-center text-primary-foreground space-y-6 animate-fade-in">
            <h2 className="font-display text-4xl font-bold">
              All Set!
            </h2>
            <p className="text-lg text-primary-foreground/80">
              Your password has been updated. Sign in to continue managing your field service operations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isValidSession === false) {
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
            <h1 className="font-display text-3xl font-bold text-foreground">Invalid or expired link</h1>
            <p className="text-muted-foreground">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Button
              className="w-full gap-2"
              onClick={() => navigate('/forgot-password')}
            >
              Request new link
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="hidden lg:flex flex-1 items-center justify-center bg-primary p-12">
          <div className="max-w-lg text-center text-primary-foreground space-y-6 animate-fade-in">
            <h2 className="font-display text-4xl font-bold">
              Link Expired
            </h2>
            <p className="text-lg text-primary-foreground/80">
              Password reset links expire for security. Request a new one to continue.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Validating reset link...</div>
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
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary mb-4">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">Set new password</h1>
            <p className="mt-2 text-muted-foreground">
              Your new password must be different from previously used passwords.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn('pl-10 pr-10', errors.password && 'border-destructive')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn('pl-10 pr-10', errors.confirmPassword && 'border-destructive')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
            </div>

            <Button type="submit" className="w-full gap-2" disabled={isLoading}>
              {isLoading ? 'Resetting...' : 'Reset password'}
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
            Create New Password
          </h2>
          <p className="text-lg text-primary-foreground/80">
            Choose a strong password with at least 6 characters to keep your account secure.
          </p>
        </div>
      </div>
    </div>
  );
}
