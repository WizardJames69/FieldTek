import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Lock, Eye, EyeOff, ArrowLeft, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { AuthLayout } from '@/components/auth/AuthLayout';

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
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
      } else if (session) {
        setIsValidSession(true);
      }
    });

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
      await supabase.auth.signOut();
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <AuthLayout>
        <div className="space-y-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10 mb-2">
            <CheckCircle className="h-8 w-8 text-orange-500" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">Password reset successful</h1>
          <p className="text-zinc-500">
            Your password has been successfully reset. You can now sign in with your new password.
          </p>
          <Button
            className="w-full h-11 rounded-[10px] bg-orange-500 hover:bg-orange-600 text-white font-semibold cta-glow"
            onClick={() => navigate('/auth')}
          >
            Sign in
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Invalid session
  if (isValidSession === false) {
    return (
      <AuthLayout>
        <div className="space-y-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-white">Invalid or expired link</h1>
          <p className="text-zinc-500">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Button
            className="w-full h-11 rounded-[10px] bg-orange-500 hover:bg-orange-600 text-white font-semibold cta-glow"
            onClick={() => navigate('/forgot-password')}
          >
            Request new link
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Loading/validating
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08090A]">
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Validating reset link...</span>
        </div>
      </div>
    );
  }

  // Form
  return (
    <AuthLayout>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="space-y-8">
        <div className="text-center">
          <div className="mb-4">
            <span className="font-display text-2xl font-bold text-white">Field</span>
            <span className="font-display text-2xl font-bold text-orange-500">Tek</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">Set new password</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Your new password must be different from previously used passwords.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-zinc-300">New password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={cn('pl-10 pr-10 h-11 rounded-[10px]', errors.password && 'border-red-500')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-300">Confirm new password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={cn('pl-10 pr-10 h-11 rounded-[10px]', errors.confirmPassword && 'border-red-500')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-sm text-red-400">{errors.confirmPassword}</p>}
          </div>

          <Button
            type="submit"
            className="w-full h-11 rounded-[10px] bg-orange-500 hover:bg-orange-600 text-white font-semibold cta-glow"
            disabled={isLoading}
          >
            {isLoading ? 'Resetting...' : 'Reset password'}
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
