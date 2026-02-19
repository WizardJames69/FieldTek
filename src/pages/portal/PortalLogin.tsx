import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, LogIn, ArrowLeft } from 'lucide-react';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function PortalLogin() {
  const [loading, setLoading] = useState(false);
  const [signInSuccess, setSignInSuccess] = useState(false);
  const { signIn, loading: authLoading, user, client, clientLoading, isWrongUserType } = usePortalAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/portal';

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Navigate when user is authenticated after sign-in
  useEffect(() => {
    if (!signInSuccess) return;

    // If this is a tenant user (not a portal client), show error and reset
    if (user && !authLoading && !clientLoading && isWrongUserType) {
      toast({
        title: 'Wrong account type',
        description: 'This account is not a customer account. Please use the main login instead.',
        variant: 'destructive',
      });
      setLoading(false);
      setSignInSuccess(false);
      return;
    }

    // Wait for both user auth AND client record to be loaded before navigating
    if (user && !authLoading && !clientLoading && client) {
      navigate(redirectTo);
      return;
    }
    
    // Fallback timeout to prevent infinite loading state
    const timeout = setTimeout(() => {
      console.log('[PortalLogin] Fallback timeout triggered, resetting loading state');
      setLoading(false);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [signInSuccess, user, authLoading, clientLoading, client, isWrongUserType, navigate, redirectTo, toast]);

  const onSubmit = async (data: LoginFormData) => {
    console.log('[PortalLogin] Sign-in attempt');
    setLoading(true);
    const { error } = await signIn(data.email, data.password);

    if (error) {
      setLoading(false);
      console.error('[PortalLogin] Sign-in error:', error.message);
      toast({
        title: 'Login failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    console.log('[PortalLogin] Sign-in call successful, waiting for auth state...');
    setSignInSuccess(true);
    // Don't setLoading(false) here - keep loading until navigation happens
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
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
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <LogIn className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Customer Portal</CardTitle>
          <CardDescription>
            Sign in to view your jobs, invoices, and submit service requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="portal-login-form">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        data-testid="portal-login-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        data-testid="portal-login-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={loading} data-testid="portal-login-submit">
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4 mr-2" />
                )}
                Sign In
              </Button>
            </form>
          </Form>

          <div className="text-center mt-6 space-y-2">
            <p className="text-sm text-muted-foreground">
              Received an invitation? Check your email for the signup link.
            </p>
            <Button
              variant="link"
              className="text-sm p-0 h-auto text-accent"
              onClick={() => navigate('/forgot-password')}
            >
              Forgot your password?
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
