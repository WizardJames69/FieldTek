import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CheckCircle, XCircle, Loader2, UserPlus, Mail, Lock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignUpValues = z.infer<typeof signUpSchema>;

interface InvitationInfo {
  valid: boolean;
  email?: string;
  role?: string;
  tenant_name?: string;
  expires_at?: string;
  error?: string;
}

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Fetch invitation details
  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) {
        setInvitation({ valid: false, error: 'No invitation token provided' });
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('get_invitation_by_token', {
          p_token: token,
        });

        if (error) throw error;

        const invitationData = data as unknown as InvitationInfo;
        setInvitation(invitationData);

        // If user is not logged in and invitation is valid, they need to sign up
        if (invitationData?.valid && !user) {
          setIsNewUser(true);
        }
      } catch (error) {
        console.error('Error fetching invitation:', error);
        setInvitation({ valid: false, error: 'Failed to load invitation' });
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token, user]);

  // Accept invitation for existing users
  const handleAcceptInvitation = async () => {
    if (!token || !user) return;

    setAccepting(true);
    try {
      const { data, error } = await supabase.rpc('accept_team_invitation', {
        p_token: token,
        p_user_id: user.id,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; tenant_id?: string };

      if (result.success) {
        toast.success('Welcome to the team!', {
          description: `You've joined ${invitation?.tenant_name}`,
        });
        navigate('/dashboard');
      } else {
        throw new Error(result.error || 'Failed to accept invitation');
      }
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast.error('Failed to accept invitation', {
        description: error.message,
      });
    } finally {
      setAccepting(false);
    }
  };

  // Sign up new user and accept invitation
  const handleSignUp = async (values: SignUpValues) => {
    if (!token || !invitation?.email) return;

    setAccepting(true);
    try {
      // Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/accept-invite?token=${token}`,
          data: {
            full_name: values.fullName,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        // Accept the invitation
        const { data, error } = await supabase.rpc('accept_team_invitation', {
          p_token: token,
          p_user_id: authData.user.id,
        });

        if (error) throw error;

        const result = data as { success: boolean; error?: string };

        if (result.success) {
          toast.success('Account created successfully!', {
            description: `You've joined ${invitation?.tenant_name}`,
          });
          navigate('/dashboard');
        } else {
          throw new Error(result.error || 'Failed to accept invitation');
        }
      }
    } catch (error: any) {
      console.error('Error signing up:', error);
      toast.error('Failed to create account', {
        description: error.message,
      });
    } finally {
      setAccepting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid invitation
  if (!invitation?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Invalid Invitation</h2>
            <p className="text-muted-foreground text-center mb-6">
              {invitation?.error || 'This invitation link is invalid or has expired.'}
            </p>
            <Button onClick={() => navigate('/')}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is logged in - show accept button
  if (user && !isNewUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <UserPlus className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Join {invitation.tenant_name}</CardTitle>
            <CardDescription>
              You've been invited to join as a {invitation.role}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Team</span>
                <span className="font-medium">{invitation.tenant_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Role</span>
                <Badge variant="secondary" className="capitalize">{invitation.role}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="text-sm">{invitation.email}</span>
              </div>
            </div>

            <Button 
              className="w-full" 
              size="lg" 
              onClick={handleAcceptInvitation}
              disabled={accepting}
            >
              {accepting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept Invitation
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Logged in as {user.email}. 
              <button 
                className="text-primary hover:underline ml-1"
                onClick={() => supabase.auth.signOut()}
              >
                Sign out
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // New user - show sign up form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Create Your Account</CardTitle>
          <CardDescription>
            Join {invitation.tenant_name} as a {invitation.role}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 mb-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{invitation.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Role</span>
              <Badge variant="secondary" className="capitalize">{invitation.role}</Badge>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSignUp)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="John Doe"
                          className="pl-9"
                          {...field}
                        />
                      </div>
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
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="pl-9"
                          {...field}
                        />
                      </div>
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
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="pl-9"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" size="lg" disabled={accepting}>
                {accepting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account & Join'
                )}
              </Button>
            </form>
          </Form>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Already have an account?{' '}
            <a href="/auth" className="text-primary hover:underline">
              Sign in
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}