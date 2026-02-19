import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";

/**
 * Post-checkout handoff route.
 * This page waits for the tenant context to be ready after checkout,
 * then redirects to the dashboard.
 */
export default function PostCheckout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading, refreshTenant, refreshSession, role } = useTenant();
  
  const [status, setStatus] = useState<"waiting" | "ready" | "timeout">("waiting");
  const [attemptCount, setAttemptCount] = useState(0);
  
  // Use refs to track progress without triggering re-renders
  const attemptCountRef = useRef(0);
  const sessionRefreshedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const redirectedRef = useRef(false);
  const checkIntervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  
  const fromCheckout = searchParams.get("from") === "checkout";

  // Clear all timers
  const clearTimers = () => {
    if (checkIntervalRef.current) {
      window.clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Main effect: start polling ONCE when mounted
  useEffect(() => {
    if (authLoading || !user) return;
    if (hasStartedRef.current) return; // Prevent re-initialization
    
    // If tenant and role are already ready, redirect immediately
    if (tenant && role && !tenantLoading) {
      if (!redirectedRef.current) {
        redirectedRef.current = true;
        setStatus("ready");
        const t = window.setTimeout(() => {
          navigate("/dashboard?from=checkout", { replace: true });
        }, 200);
        return () => window.clearTimeout(t);
      }
      return;
    }

    hasStartedRef.current = true;

    // Polling function with debounce protection
    const checkTenantReady = async () => {
      if (isRefreshingRef.current) return; // Skip if already refreshing
      
      attemptCountRef.current++;
      setAttemptCount(attemptCountRef.current); // Update UI only
      
      isRefreshingRef.current = true;
      try {
        // After 3 attempts, try refreshing the session
        if (attemptCountRef.current === 3 && !sessionRefreshedRef.current) {
          console.log("PostCheckout: Refreshing session...");
          sessionRefreshedRef.current = true;
          await refreshSession();
        }
        await refreshTenant();
      } finally {
        isRefreshingRef.current = false;
      }
    };

    // Start polling every 800ms
    checkIntervalRef.current = window.setInterval(checkTenantReady, 800);

    // Hard timeout after 15 seconds
    timeoutRef.current = window.setTimeout(() => {
      clearTimers();
      setStatus("timeout");
    }, 15000);

    return () => clearTimers();
  }, [authLoading, user]); // Minimal deps - don't include attemptCount!

  // Separate effect to watch for tenant becoming ready
  useEffect(() => {
    if (tenant && role && !tenantLoading && status === "waiting" && !redirectedRef.current) {
      redirectedRef.current = true;
      setStatus("ready");
      clearTimers();
      setTimeout(() => navigate("/dashboard?from=checkout", { replace: true }), 200);
    }
  }, [tenant, role, tenantLoading, status, navigate]);

  const handleRetry = async () => {
    // Reset all refs to allow re-initialization
    hasStartedRef.current = false;
    attemptCountRef.current = 0;
    sessionRefreshedRef.current = false;
    redirectedRef.current = false;
    isRefreshingRef.current = false;
    
    setStatus("waiting");
    setAttemptCount(0);
    
    await refreshSession();
    await refreshTenant();
  };

  const handleContinueToDashboard = () => {
    navigate("/dashboard?from=checkout", { replace: true });
  };

  const handleGoToOnboarding = () => {
    navigate("/onboarding", { replace: true });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "ready" ? (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-emerald-600 dark:text-emerald-400">Workspace Ready!</CardTitle>
              <CardDescription>Redirecting to your dashboard...</CardDescription>
            </>
          ) : status === "timeout" ? (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <RefreshCw className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle>Taking Longer Than Expected</CardTitle>
              <CardDescription>
                Your workspace is being set up. You can wait or continue to the dashboard.
              </CardDescription>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <CardTitle>Setting Up Your Workspace</CardTitle>
              <CardDescription>
                {fromCheckout 
                  ? "Finalizing your subscription and preparing your dashboard..."
                  : "Loading your workspace data..."
                }
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {status === "waiting" && (
            <div className="text-center text-sm text-muted-foreground">
              <p>This usually takes just a moment.</p>
              {attemptCount > 2 && (
                <p className="mt-2 text-xs">
                  Checking workspace ({attemptCount}/15)...
                </p>
              )}
            </div>
          )}

          {status === "timeout" && (
            <div className="space-y-3">
              <Button onClick={handleRetry} variant="outline" className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
              <Button onClick={handleContinueToDashboard} className="w-full gap-2">
                Continue to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button onClick={handleGoToOnboarding} variant="ghost" className="w-full text-muted-foreground">
                Start Fresh Setup
              </Button>
            </div>
          )}

          {status === "ready" && (
            <div className="flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
