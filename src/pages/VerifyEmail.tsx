import { useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  
  const email = location.state?.email || '';

  const handleResendEmail = async () => {
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Email not found',
        description: 'Please try registering again.',
      });
      return;
    }

    setIsResending(true);
    
    try {
      // Use our custom edge function to send the verification email
      const { error } = await supabase.functions.invoke('send-auth-email', {
        body: {
          email,
          type: 'signup',
          redirect_to: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Failed to resend',
          description: error.message || 'Please try again.',
        });
      } else {
        toast({
          title: 'Email sent!',
          description: 'Check your inbox for the verification link.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to resend',
        description: err.message || 'Please try again.',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="w-full max-w-md space-y-8 text-center animate-fade-up">
        {/* Email Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mx-auto">
          <Mail className="h-10 w-10 text-primary" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold text-foreground">Check your email</h1>
          <p className="text-muted-foreground">
            We've sent a verification link to
          </p>
          {email && (
            <p className="font-medium text-foreground">{email}</p>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-muted/50 rounded-lg p-6 space-y-3 text-left">
          <h3 className="font-semibold text-foreground">What to do next:</h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Open your email inbox</li>
            <li>Look for an email from FieldTek</li>
            <li>Click the verification link in the email</li>
            <li>You'll be automatically signed in</li>
          </ol>
        </div>

        {/* Didn't receive email */}
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Didn't receive the email? Check your spam folder or
          </p>
          <Button
            variant="outline"
            onClick={handleResendEmail}
            disabled={isResending || !email}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isResending ? 'animate-spin' : ''}`} />
            {isResending ? 'Sending...' : 'Resend verification email'}
          </Button>
        </div>

        {/* Back to sign in */}
        <Button
          variant="ghost"
          onClick={() => navigate('/auth')}
          className="gap-2 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Button>
      </div>
    </div>
  );
}
