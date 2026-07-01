import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CheckCircle, XCircle, Loader2, UserPlus, Lock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      password: '',
      confirmPassword: '',
    },
  });

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

  // The signed-in user is on the wrong account for this invite. The RPC would
  // reject with an email-ownership error; we surface a friendly prompt instead.
  const emailMismatch =
    !!user?.email &&
    !!invitation?.email &&
    user.email.toLowerCase() !== invitation.email.toLowerCase();

  // Map known raw RPC/auth errors to friendly, user-facing copy. The DB security
  // guard is unchanged — this only translates its messages for display.
  const friendlyInviteError = (message?: string): string => {
    if (!message) return 'Something went wrong. Please try again.';
    if (message.includes('User identity mismatch')) {
      return 'We could not verify your session. Please sign in with the invited email and try again.';
    }
    if (message.includes('different email address')) {
      return 'This invitation was sent to a different email. Sign out and use the invited email to continue.';
    }
    if (message.toLowerCase().includes('already a member')) {
      return "You're already a member of this team.";
    }
    if (message.toLowerCase().includes('invalid or expired')) {
      return 'This invitation is invalid or has expired.';
    }
    return message;
  };

  const handleAcceptInvitation = async () => {
    if (!token || !user) return;

    // Block acceptance from the wrong account before hitting the RPC.
    if (emailMismatch) {
      toast.error('Wrong account', {
        description: 'This invitation was sent to a different email. Sign out and use the invited email to continue.',
      });
      return;
    }

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
      // Message only — never log tokens or the invite link.
      console.error('Error accepting invitation:', error?.message ?? error);
      toast.error('Could not accept invitation', {
        description: friendlyInviteError(error?.message),
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleSignUp = async (values: SignUpValues) => {
    if (!token || !invitation?.email) return;

    setAccepting(true);
    try {
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

      // Email confirmation is enabled, so signUp returns a user but NO session.
      // Without a session auth.uid() is null, and accept_team_invitation() would
      // (correctly) reject with "User identity mismatch". Do NOT call it yet —
      // the invite completes when the user confirms their email and returns here
      // signed in (emailRedirectTo brings them back to this page, where the
      // logged-in branch calls the RPC with a real session). Show a clear
      // "check your email" state instead of a confusing failure.
      if (authData.user && !authData.session) {
        setConfirmEmailSent(true);
        toast.success('Account created', {
          description: `Check your email to confirm your account, then return to finish joining ${invitation.tenant_name ?? 'the team'}.`,
        });
        return;
      }

      // Session present (auto-confirm / confirmation disabled) → the caller is
      // authenticated, so completing acceptance immediately is safe.
      if (authData.user && authData.session) {
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
      // Message only — never log tokens or the invite link.
      console.error('Error signing up for invite:', error?.message ?? error);
      toast.error('Could not create your account', {
        description: friendlyInviteError(error?.message),
      });
    } finally {
      setAccepting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08090A]">
        <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
        <div className="w-full max-w-md bg-[#111214] border border-white/[0.06] rounded-2xl p-8">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-4" />
            <p className="text-zinc-500">Loading invitation...</p>
          </div>
        </div>
      </div>
    );
  }

  // Invalid invitation
  if (!invitation?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08090A] p-4">
        <div className="w-full max-w-md bg-[#111214] border border-white/[0.06] rounded-2xl p-8">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Invalid Invitation</h2>
            <p className="text-zinc-500 text-center mb-6">
              {invitation?.error || 'This invitation link is invalid or has expired.'}
            </p>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-[10px]"
              onClick={() => navigate('/')}
            >
              Go to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Account created but email confirmation is still required (no session yet).
  // The invite is not lost — it completes when the user confirms and returns.
  if (confirmEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08090A] p-4">
        <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
        <div className="w-full max-w-md bg-[#111214] border border-white/[0.06] rounded-2xl p-8">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-orange-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Check your email</h2>
            <p className="text-zinc-500 mb-2">
              Your account was created. We sent a confirmation link to{' '}
              <span className="text-zinc-300">{invitation.email}</span>.
            </p>
            <p className="text-zinc-500">
              Confirm your email, then return here to finish joining{' '}
              <span className="text-zinc-300">{invitation.tenant_name}</span>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Signed in with a different email than the invite → prompt to switch accounts
  // instead of letting the RPC reject with an email-ownership error.
  if (user && !isNewUser && emailMismatch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08090A] p-4">
        <div className="w-full max-w-md bg-[#111214] border border-white/[0.06] rounded-2xl p-8">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Wrong account</h2>
            <p className="text-zinc-500 mb-6">
              This invitation was sent to{' '}
              <span className="text-zinc-300">{invitation.email}</span>, but you're
              signed in as <span className="text-zinc-300">{user.email}</span>. Sign
              out and use the invited email to continue.
            </p>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-[10px]"
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // User is logged in - show accept button
  if (user && !isNewUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08090A] p-4">
        <div className="w-full max-w-md bg-[#111214] border border-white/[0.06] rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="h-16 w-16 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
              <UserPlus className="h-8 w-8 text-orange-500" />
            </div>
            <h2 className="text-xl font-semibold text-white">Join {invitation.tenant_name}</h2>
            <p className="text-sm text-zinc-500 mt-1">
              You've been invited to join as a {invitation.role}
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Team</span>
                <span className="font-medium text-white">{invitation.tenant_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Role</span>
                <Badge variant="secondary" className="capitalize bg-white/[0.06] text-zinc-300 border-0">{invitation.role}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Email</span>
                <span className="text-sm text-zinc-300">{invitation.email}</span>
              </div>
            </div>

            <Button
              className="w-full h-11 rounded-[10px] bg-orange-500 hover:bg-orange-600 text-white font-semibold cta-glow"
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

            <p className="text-xs text-center text-zinc-600">
              Logged in as {user.email}.
              <button
                className="text-orange-500 hover:text-orange-400 ml-1 transition-colors"
                onClick={() => supabase.auth.signOut()}
              >
                Sign out
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // New user - show sign up form
  return (
    <div className="auth-page flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111214] border border-white/[0.06] rounded-2xl p-8">
        <div className="text-center mb-6">
          <div className="h-16 w-16 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="h-8 w-8 text-orange-500" />
          </div>
          <h2 className="text-xl font-semibold text-white">Create Your Account</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Join {invitation.tenant_name} as a {invitation.role}
          </p>
        </div>

        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-4 mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Email</span>
            <span className="text-sm font-medium text-zinc-300">{invitation.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Role</span>
            <Badge variant="secondary" className="capitalize bg-white/[0.06] text-zinc-300 border-0">{invitation.role}</Badge>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSignUp)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">Full Name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        placeholder="John Doe"
                        className="pl-9 h-11 rounded-[10px]"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="pl-9 h-11 rounded-[10px]"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">Confirm Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="pl-9 h-11 rounded-[10px]"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full h-11 rounded-[10px] bg-orange-500 hover:bg-orange-600 text-white font-semibold cta-glow"
              disabled={accepting}
            >
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

        <p className="text-xs text-center text-zinc-600 mt-4">
          Already have an account?{' '}
          <a href="/auth" className="text-orange-500 hover:text-orange-400 transition-colors">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
