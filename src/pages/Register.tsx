import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, ArrowLeft, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Logo } from '@/components/ui/Logo';

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
  
  // All hooks must be declared before any conditional returns
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
  
  // Get access code from URL params
  const urlAccessCode = searchParams.get('access');

  // Validate access code (from URL or manual entry)
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

  // Auto-validate if code provided in URL
  useEffect(() => {
    if (urlAccessCode) {
      setManualAccessCode(urlAccessCode);
      validateAccessCode(urlAccessCode);
    }
  }, [urlAccessCode]);

  useEffect(() => {
    // Only redirect if user was ALREADY logged in (not a fresh signup)
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
      
      // Handle duplicate registration - Supabase may return various messages
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
    // Mark as new signup to prevent useEffect redirect
    setIsNewSignup(true);
    
    // Send welcome email with better logging
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
            <h1 className="font-display text-3xl font-bold text-foreground">
              {hasAccess ? 'Create your account' : 'Enter your access code'}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {hasAccess 
                ? 'Beta access — Founding Member' 
                : 'Approved beta testers receive a code via email'}
            </p>
          </div>

          {/* Access Code Form - shown when not yet validated */}
          {!hasAccess && (
            <form onSubmit={handleAccessCodeSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="accessCode">Beta Access Code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="accessCode"
                    type="text"
                    value={manualAccessCode}
                    onChange={(e) => {
                      setManualAccessCode(e.target.value.toUpperCase());
                      setAccessError('');
                    }}
                    placeholder="BETA-FOUNDING-XXXXXX"
                    className={cn('pl-10 uppercase tracking-wider', accessError && 'border-destructive')}
                    autoComplete="off"
                    data-testid="access-code-input"
                  />
                </div>
                {accessError && <p className="text-sm text-destructive">{accessError}</p>}
              </div>

              <Button 
                type="submit" 
                className="w-full gap-2" 
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
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="text-center space-y-3">
                <p className="text-muted-foreground text-sm">
                  Don't have an access code?{' '}
                  <Button
                    variant="link"
                    className="p-0 h-auto text-accent"
                    onClick={() => navigate('/#beta-program')}
                  >
                    Apply for beta access
                  </Button>
                </p>
                <p className="text-muted-foreground">
                  Already have an account?{' '}
                  <Button
                    variant="link"
                    className="p-0 h-auto text-accent"
                    onClick={() => navigate('/auth')}
                  >
                    Sign in
                  </Button>
                </p>
              </div>
            </form>
          )}

          {/* Registration Form - shown after access validated */}
          {hasAccess && (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Smith"
                      className={cn('pl-10', errors.fullName && 'border-destructive')}
                      data-testid="register-name-input"
                    />
                  </div>
                  {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className={cn('pl-10', errors.email && 'border-destructive')}
                      data-testid="register-email-input"
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
                      data-testid="register-password-input"
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
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={cn('pl-10', errors.confirmPassword && 'border-destructive')}
                      data-testid="register-confirm-password-input"
                    />
                  </div>
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                </div>

                <Button type="submit" className="w-full gap-2" disabled={isLoading} data-testid="register-submit-button">
                  {isLoading ? 'Creating account...' : 'Create account'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <div className="text-center">
                <p className="text-muted-foreground">
                  Already have an account?{' '}
                  <Button
                    variant="link"
                    className="p-0 h-auto text-accent"
                    onClick={() => navigate('/auth')}
                  >
                    Sign in
                  </Button>
                </p>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                By creating an account, you agree to our Terms of Service and Privacy Policy.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Right Side - Branding */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-primary p-12">
        <div className="max-w-lg text-center text-primary-foreground space-y-6 animate-fade-in">
          <h2 className="font-display text-4xl font-bold">
            Everything you need to grow your business
          </h2>
          <ul className="text-left space-y-4 text-lg">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-bold">✓</span>
              <span>Smart job scheduling and dispatch</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-bold">✓</span>
              <span>AI-powered field assistant for technicians</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-bold">✓</span>
              <span>Invoicing and payment tracking</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-bold">✓</span>
              <span>Customer portal for service requests</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-bold">✓</span>
              <span>White-label branding for your company</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
