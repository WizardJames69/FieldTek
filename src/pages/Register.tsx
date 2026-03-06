import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { BetaTesterModal } from '@/components/landing/BetaTesterModal';

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const registerSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email').max(255),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUp, user } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isNewSignup, setIsNewSignup] = useState(false);

  // Access validation state
  const [isValidatingAccess, setIsValidatingAccess] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [isBetaFounder, setIsBetaFounder] = useState(false);
  const [manualAccessCode, setManualAccessCode] = useState('');
  const [accessError, setAccessError] = useState('');
  const [betaModalOpen, setBetaModalOpen] = useState(false);

  const urlAccessCode = searchParams.get('access');

  const validateAccessCode = async (code: string) => {
    if (!code.trim()) {
      setAccessError('Please enter your access code');
      return false;
    }

    setIsValidatingAccess(true);
    setAccessError('');

    try {
      console.log('[Register] Validating access code server-side...');
      const { data, error } = await supabase.functions.invoke('validate-access-code', {
        body: { code: code.trim() }
      });

      if (error) {
        console.error('[Register] Access validation error:', error);
        setAccessError('Unable to validate code. Please try again.');
        setIsValidatingAccess(false);
        return false;
      }

      if (data?.valid) {
        console.log('[Register] Access code valid, is_beta_code:', data.is_beta_code);
        setHasAccess(true);
        setIsBetaFounder(data.is_beta_code === true);
        setIsValidatingAccess(false);
        return true;
      } else {
        console.log('[Register] Access code invalid');
        setAccessError('Invalid access code. Please check your code and try again.');
        setIsValidatingAccess(false);
        return false;
      }
    } catch (err) {
      console.error('[Register] Access validation failed:', err);
      setAccessError('Unable to validate code. Please try again.');
      setIsValidatingAccess(false);
      return false;
    }
  };

  useEffect(() => {
    if (urlAccessCode) {
      setManualAccessCode(urlAccessCode);
      validateAccessCode(urlAccessCode);
    }
  }, [urlAccessCode]);

  useEffect(() => {
    if (user && !isNewSignup) {
      navigate('/onboarding');
    }
  }, [user, isNewSignup, navigate]);

  const handleAccessCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await validateAccessCode(manualAccessCode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    console.log('[Register] Attempting registration for:', email);

    const result = registerSchema.safeParse({ fullName, email, password, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      console.log('[Register] Validation failed:', fieldErrors);
      return;
    }

    setIsLoading(true);
    console.log('[Register] Calling signUp with isBetaFounder:', isBetaFounder);
    const { error } = await signUp(email, password, fullName, isBetaFounder);
    setIsLoading(false);

    if (error) {
      console.error('[Register] SignUp error:', error.message);

      const errorLower = error.message.toLowerCase();
      const isDuplicate =
        errorLower.includes('already') ||
        errorLower.includes('exists') ||
        errorLower.includes('duplicate') ||
        errorLower.includes('in use') ||
        errorLower.includes('registered');

      if (isDuplicate) {
        setErrors({ email: 'This email is already registered. Please sign in instead.' });
        toast({
          variant: 'destructive',
          title: 'Account exists',
          description: 'This email is already registered. Please sign in instead.',
        });
      } else {
        setErrors({ email: error.message });
        toast({
          variant: 'destructive',
          title: 'Registration failed',
          description: error.message || 'Something went wrong. Please try again.',
        });
      }
      return;
    }

    console.log('[Register] SignUp successful, sending welcome email...');
    setIsNewSignup(true);

    supabase.functions.invoke('send-welcome-email', {
      body: { email, fullName }
    }).then(({ data, error: emailError }) => {
      if (emailError) {
        console.error('[Register] Welcome email failed:', emailError);
      } else {
        console.log('[Register] Welcome email sent:', data);
      }
    });

    console.log('[Register] Navigating to /verify-email');
    navigate('/verify-email', { state: { email } });
  };

  return (
    <AuthLayout maxWidth="max-w-[480px]">
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
          <h1 className="font-display text-2xl font-semibold text-white">
            {hasAccess ? 'Create your account' : 'Enter your access code'}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {hasAccess
              ? 'Beta access — Founding Member'
              : 'Approved beta testers receive a code via email'}
          </p>
        </div>

        {/* Access Code Form */}
        {!hasAccess && (
          <form onSubmit={handleAccessCodeSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="accessCode" className="text-sm font-medium text-zinc-300">Beta Access Code</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  id="accessCode"
                  type="text"
                  value={manualAccessCode}
                  onChange={(e) => {
                    setManualAccessCode(e.target.value.toUpperCase());
                    setAccessError('');
                  }}
                  placeholder="BETA-FOUNDING-XXXXXX"
                  className={cn('pl-10 h-11 rounded-[10px] uppercase tracking-wider', accessError && 'border-red-500')}
                  autoComplete="off"
                  data-testid="access-code-input"
                />
              </div>
              {accessError && <p className="text-sm text-red-400">{accessError}</p>}
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-[10px] bg-orange-500 hover:bg-orange-600 text-white font-semibold cta-glow"
              disabled={isValidatingAccess}
              data-testid="verify-access-button"
            >
              {isValidatingAccess ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify Access Code
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="text-center space-y-3">
              <p className="text-zinc-500 text-sm">
                Don't have an access code?{' '}
                <button
                  className="text-orange-500 hover:text-orange-400 transition-colors"
                  onClick={() => setBetaModalOpen(true)}
                >
                  Apply for beta access
                </button>
              </p>
              <p className="text-zinc-500 text-sm">
                Already have an account?{' '}
                <button
                  className="text-orange-500 hover:text-orange-400 transition-colors"
                  onClick={() => navigate('/auth')}
                >
                  Sign in
                </button>
              </p>
            </div>
          </form>
        )}

        {/* Registration Form */}
        {hasAccess && (
          <>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="fullName" className="text-sm font-medium text-zinc-300">Full name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Smith"
                    className={cn('pl-10 h-11 rounded-[10px]', errors.fullName && 'border-red-500')}
                    data-testid="register-name-input"
                  />
                </div>
                {errors.fullName && <p className="text-sm text-red-400">{errors.fullName}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-zinc-300">Work email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className={cn('pl-10 h-11 rounded-[10px]', errors.email && 'border-red-500')}
                    data-testid="register-email-input"
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
                    data-testid="register-password-input"
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
                <label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-300">Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={cn('pl-10 h-11 rounded-[10px]', errors.confirmPassword && 'border-red-500')}
                    data-testid="register-confirm-password-input"
                  />
                </div>
                {errors.confirmPassword && <p className="text-sm text-red-400">{errors.confirmPassword}</p>}
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-[10px] bg-orange-500 hover:bg-orange-600 text-white font-semibold cta-glow"
                disabled={isLoading}
                data-testid="register-submit-button"
              >
                {isLoading ? 'Creating account...' : 'Create account'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <div className="text-center">
              <p className="text-zinc-500 text-sm">
                Already have an account?{' '}
                <button
                  className="text-orange-500 hover:text-orange-400 transition-colors"
                  onClick={() => navigate('/auth')}
                >
                  Sign in
                </button>
              </p>
            </div>

            <p className="text-xs text-center text-zinc-600">
              By creating an account, you agree to our Terms of Service and Privacy Policy.
            </p>
          </>
        )}
      </div>
      <BetaTesterModal open={betaModalOpen} onOpenChange={setBetaModalOpen} />
    </AuthLayout>
  );
}
