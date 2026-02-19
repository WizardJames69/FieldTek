import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, ArrowRight, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenant } from "@/contexts/TenantContext";
import { PostCheckoutWizard } from "@/components/billing/PostCheckoutWizard";
import type { OnboardingProgress } from "@/hooks/useOnboardingProgress";

export default function BillingSuccess() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant, loading: tenantLoading, refreshTenant } = useTenant();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [tier, setTier] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const welcomeEmailSentRef = useRef(false);

  // Whether the user wants to see the setup wizard instead of auto-redirecting
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  // Auto-redirect to dashboard after success (user can cancel)
  const [autoRedirectEnabled, setAutoRedirectEnabled] = useState(true);
  const [redirectSeconds, setRedirectSeconds] = useState<number | null>(null);
  const redirectTimeoutRef = useRef<number | null>(null);
  const redirectIntervalRef = useRef<number | null>(null);

  const checkoutSessionId = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("session_id");
    } catch {
      return null;
    }
  }, []);

  // Use the dedicated post-checkout route to wait for tenant readiness
  // This keeps checkout logic separate from Dashboard and ensures a clean handoff
  const postCheckoutRoute = "/post-checkout?from=checkout";

  // Fetch onboarding progress to detect if user is "new"
  const { data: onboardingProgress } = useQuery({
    queryKey: ["onboarding-progress", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data, error } = await supabase
        .from("onboarding_progress")
        .select("*")
        .eq("tenant_id", tenant.id)
        .maybeSingle();
      if (error) return null;
      return data as OnboardingProgress;
    },
    enabled: !!tenant?.id && status === "success",
  });

  // Determine if the user is "new" (has incomplete onboarding steps)
  const isNewUser = useMemo(() => {
    if (!onboardingProgress) return false;
    const steps = [
      onboardingProgress.branding_completed,
      onboardingProgress.first_client_added,
      onboardingProgress.first_job_created,
      onboardingProgress.first_team_member_invited,
      onboardingProgress.first_invoice_created,
    ];
    const incomplete = steps.filter((s) => !s).length;
    // Consider "new" if 3 or more steps are incomplete
    return incomplete >= 3;
  }, [onboardingProgress]);

  // When subscription confirmed, check if new user and show wizard instead of auto-redirect
  // Only switch to wizard once we have determined if user is new (after onboardingProgress loads)
  useEffect(() => {
    if (status === "success" && onboardingProgress && isNewUser && !showSetupWizard) {
      // Disable auto-redirect and show wizard for new users
      setAutoRedirectEnabled(false);
      setShowSetupWizard(true);
    }
  }, [status, onboardingProgress, isNewUser, showSetupWizard]);

  // Auto-redirect timer: starts on success and runs independently
  // Wait for tenant to finish loading before starting redirect timer
  useEffect(() => {
    // Clear timers if not in success state, user opted out, wizard is showing, or tenant still loading
    if (status !== "success" || !autoRedirectEnabled || showSetupWizard || tenantLoading) {
      if (redirectTimeoutRef.current) window.clearTimeout(redirectTimeoutRef.current);
      if (redirectIntervalRef.current) window.clearInterval(redirectIntervalRef.current);
      redirectTimeoutRef.current = null;
      redirectIntervalRef.current = null;
      setRedirectSeconds(null);
      return;
    }

    // Start countdown immediately on success (after tenant is loaded)
    const seconds = 5;
    setRedirectSeconds(seconds);

    redirectIntervalRef.current = window.setInterval(() => {
      setRedirectSeconds((s) => (typeof s === "number" ? Math.max(0, s - 1) : s));
    }, 1000);

    redirectTimeoutRef.current = window.setTimeout(() => {
      navigate(postCheckoutRoute, { replace: true });
    }, seconds * 1000);

    return () => {
      if (redirectTimeoutRef.current) window.clearTimeout(redirectTimeoutRef.current);
      if (redirectIntervalRef.current) window.clearInterval(redirectIntervalRef.current);
      redirectTimeoutRef.current = null;
      redirectIntervalRef.current = null;
    };
  }, [status, autoRedirectEnabled, showSetupWizard, navigate, postCheckoutRoute, tenantLoading]);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10;
    const timeouts: number[] = [];

    const hardStop = window.setTimeout(() => {
      // Stop showing spinner after ~25s; activation can take a bit, but don't trap the user.
      setStatus((s) => (s === "loading" ? "error" : s));
    }, 25_000);

    const clearAllTimers = () => {
      timeouts.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(hardStop);
    };

    const sendWelcomeEmail = async (
      subscriptionTier: string,
      isTrialing: boolean,
      trialEnd: string | null,
      accessToken: string
    ) => {
      // Only send once per page load
      if (welcomeEmailSentRef.current) return;
      welcomeEmailSentRef.current = true;

      try {
        await supabase.functions.invoke("send-subscription-welcome", {
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            tier: subscriptionTier,
            isTrialing,
            trialEndDate: trialEnd,
          },
        });
      } catch (err) {
        console.error("Failed to send welcome email:", err);
      }
    };

    const markSuccess = async (data: any, accessToken: string) => {
      const subscriptionTier = data?.tier || "professional";
      setTier(subscriptionTier);
      setStatus("success");
      queryClient.invalidateQueries({ queryKey: ["stripe-subscription"] });

      // Force refresh tenant context to ensure it's loaded before redirecting
      // This helps prevent the dashboard from thinking user has no tenant
      console.log('Subscription verified, refreshing tenant context...');
      await refreshTenant();

      void sendWelcomeEmail(
        subscriptionTier,
        data?.is_trialing || false,
        data?.trial_end || null,
        accessToken
      );

      clearAllTimers();
    };

    const verifyBySessionId = async (accessToken: string) => {
      if (!checkoutSessionId) return false;

      const { data, error } = await supabase.functions.invoke("verify-checkout-session", {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { session_id: checkoutSessionId },
      });

      if (error) {
        console.error("verify-checkout-session error:", error);
        return false;
      }

      if (data?.subscribed) {
        await markSuccess(data, accessToken);
        return true;
      }

      return false;
    };

    const checkSubscription = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;

        if (!accessToken) {
          setStatus("error");
          clearAllTimers();
          return;
        }

        // 1) Prefer verifying the exact Checkout Session (most reliable)
        const verified = await verifyBySessionId(accessToken);
        if (verified) return;

        // 2) Fallback: polling by email/customer lookup
        const { data, error } = await supabase.functions.invoke("check-subscription", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (error) throw error;

        if (data?.subscribed) {
          await markSuccess(data, accessToken);
          return;
        }

        if (attempts < maxAttempts) {
          attempts++;
          timeouts.push(window.setTimeout(checkSubscription, 2000));
          return;
        }

        // After max attempts, stop loading and let the user proceed.
        setStatus("error");
        queryClient.invalidateQueries({ queryKey: ["stripe-subscription"] });
        clearAllTimers();
      } catch (err) {
        console.error("Error checking subscription:", err);

        if (attempts < maxAttempts) {
          attempts++;
          timeouts.push(window.setTimeout(checkSubscription, 2000));
          return;
        }

        setStatus("error");
        clearAllTimers();
      }
    };

    checkSubscription();

    return () => {
      clearAllTimers();
    };
  }, [queryClient, checkoutSessionId, refreshKey]);

  // Show setup wizard for new users after success
  if (status === "success" && showSetupWizard && onboardingProgress) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-6">
          {/* Success header */}
          <Card className="border-emerald-200 dark:border-emerald-800/50">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-emerald-600 dark:text-emerald-400">Subscription Activated!</CardTitle>
              <CardDescription>
                {tier ? (
                  <>
                    Your <span className="font-medium capitalize">{tier}</span> plan is now active.
                  </>
                ) : (
                  "Your subscription is now active."
                )}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Setup wizard */}
          <PostCheckoutWizard
            progress={onboardingProgress}
            tier={tier}
            onSkip={() => navigate("/dashboard?from=checkout", { replace: true })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <CardTitle>Confirming Your Subscription</CardTitle>
              <CardDescription>Please wait while we verify your payment...</CardDescription>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-emerald-600 dark:text-emerald-400">Subscription Activated!</CardTitle>
              <CardDescription>
                {tier ? (
                  <>
                    Your <span className="font-medium capitalize">{tier}</span> plan is now active.
                  </>
                ) : (
                  "Your subscription is now active."
                )}
              </CardDescription>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <CheckCircle2 className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle>Payment Received</CardTitle>
              <CardDescription>
                Your payment was successful. It may take a moment for your subscription to activate. You can continue, or
                retry verification.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {status === "success" && (
            <>
              <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                <p>🎉 Thank you for subscribing! You now have access to all features included in your plan.</p>
              </div>

              {autoRedirectEnabled && typeof redirectSeconds === "number" && (
                <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  <span>Redirecting to dashboard in {redirectSeconds}s</span>
                  <Button variant="ghost" size="sm" onClick={() => setAutoRedirectEnabled(false)}>
                    Stay here
                  </Button>
                </div>
              )}

              {/* Option to continue setup if not auto-showing wizard */}
              {!showSetupWizard && onboardingProgress && isNewUser && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setAutoRedirectEnabled(false);
                    setShowSetupWizard(true);
                  }}
                >
                  <Rocket className="h-4 w-4" />
                  Continue Setting Up
                </Button>
              )}
            </>
          )}

          {status !== "success" && (
            <Button
              variant="outline"
              onClick={() => {
                setStatus("loading");
                setRefreshKey((k) => k + 1);
              }}
              className="w-full"
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking…
                </>
              ) : (
                "Retry Verification"
              )}
            </Button>
          )}

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => navigate(postCheckoutRoute)}
              className={cn(status === "loading" && "opacity-50")}
            >
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/settings?tab=billing")}
              className={cn(status === "loading" && "opacity-50")}
            >
              View Billing Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

