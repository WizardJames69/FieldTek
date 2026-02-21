import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, UserPlus, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const signupSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;

interface InvitationData {
  email: string;
  companyName: string;
  clientName: string;
  token: string;
  primaryColor: string;
  logoUrl: string | null;
}

export default function PortalSignup() {
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('No invitation token provided. Please use the link from your email.');
        setValidating(false);
        return;
      }

      try {
        // Use secure RPC function instead of direct table query
        const { data, error: queryError } = await supabase
          .rpc('validate_portal_invitation_token', { p_token: token });

        if (queryError || !data || (Array.isArray(data) && data.length === 0)) {
          setError('Invalid invitation link. Please contact your service provider.');
          setValidating(false);
          return;
        }

        const inv = Array.isArray(data) ? data[0] : data;

        if (inv.accepted_at) {
          setError('This invitation has already been used. Please log in instead.');
          setValidating(false);
          return;
        }

        if (new Date(inv.expires_at) < new Date()) {
          setError('This invitation has expired. Please contact your service provider for a new one.');
          setValidating(false);
          return;
        }

        const { data: branding } = await supabase
          .from('tenant_branding' as any)
          .select('company_name, primary_color, logo_url')
          .eq('tenant_id', inv.tenant_id)
          .maybeSingle();

        const { data: client } = await supabase
          .from('clients' as any)
          .select('name')
          .eq('id', inv.client_id)
          .maybeSingle();

        setInvitation({
          email: inv.email,
          companyName: (branding as any)?.company_name || 'Your Service Provider',
          clientName: (client as any)?.name || '',
          token,
          primaryColor: (branding as any)?.primary_color || '#1F1B18',
          logoUrl: (branding as any)?.logo_url || null,
        });
      } catch (err) {
        setError('Something went wrong validating your invitation.');
      } finally {
        setValidating(false);
      }
    }

    validateToken();
  }, [token]);

  const onSubmit = async (values: SignupFormData) => {
    if (!invitation) return;

    setLoading(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password: values.password,
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Failed to create account');

      const { error: acceptError } = await supabase.functions.invoke(
        'accept-portal-invitation',
        { body: { token: invitation.token } }
      );

      if (acceptError) {
        console.error('Failed to accept invitation:', acceptError);
      }

      // Sign out immediately to prevent AuthProvider from routing to /onboarding
      await supabase.auth.signOut();

      toast({
        title: 'Account created!',
        description: 'You can now sign in to the customer portal.',
      });

      navigate('/portal/login');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Signup failed',
        description: err.message || 'Failed to create account',
      });
    } finally {
      setLoading(false);
    }
  };

  const accentColor = invitation?.primaryColor || '#1F1B18';

  if (validating) {
    return (
      <div className="min-h-screen bg-[#F5F3F0] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Validating your invitation...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F3F0] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl overflow-hidden shadow-xl">
            <div className="py-8 px-6 text-center" style={{ background: 'linear-gradient(135deg, #1F1B18 0%, #2D2926 100%)' }}>
              <span className="font-bold text-xl">
                <span className="text-white">Field</span>
                <span style={{ color: '#F97316' }}>Tek</span>
              </span>
            </div>
            <div className="bg-white p-8 text-center">
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Invalid Invitation</h2>
              <p className="text-muted-foreground text-sm mb-6">{error}</p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => navigate('/')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to home
                </Button>
                <Button onClick={() => navigate('/portal/login')}>
                  Go to Login
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F3F0] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Premium card with gradient header */}
        <div className="rounded-2xl overflow-hidden shadow-xl">
          {/* Gradient header */}
          <div
            className="py-10 px-6 text-center"
            style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${adjustColor(accentColor, 20)} 100%)` }}
          >
            {invitation?.logoUrl ? (
              <img
                src={invitation.logoUrl}
                alt={invitation.companyName}
                className="max-h-12 mx-auto mb-3"
              />
            ) : (
              <h1 className="text-2xl font-bold text-white mb-1">{invitation?.companyName}</h1>
            )}
            <p className="text-white/70 text-sm">Customer Portal</p>
          </div>

          {/* Form card */}
          <Card className="border-0 rounded-none shadow-none">
            <CardContent className="p-8">
              <h2 className="text-xl font-semibold text-center mb-1">Create Your Account</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Set a password to access your customer portal
              </p>

              {/* Email badge */}
              <div className="mb-6 p-3 rounded-lg border" style={{ backgroundColor: `${accentColor}08`, borderColor: `${accentColor}20` }}>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
                  <span className="text-muted-foreground">Signing up as</span>
                  <span className="font-medium text-foreground truncate">{invitation?.email}</span>
                </div>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full text-white font-semibold h-11"
                    disabled={loading}
                    style={{ background: `linear-gradient(135deg, ${accentColor}, ${adjustColor(accentColor, -10)})` }}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    Create Account
                  </Button>
                </form>
              </Form>

              <div className="text-center mt-6">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    className="font-medium hover:underline"
                    style={{ color: accentColor }}
                    onClick={() => navigate('/portal/login')}
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Powered by FieldTek footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground">
            Powered by{' '}
            <span className="font-semibold">
              <span className="text-foreground">Field</span>
              <span style={{ color: '#F97316' }}>Tek</span>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Lighten or darken a hex color by a percentage */
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + Math.round(2.55 * percent)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + Math.round(2.55 * percent)));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + Math.round(2.55 * percent)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
