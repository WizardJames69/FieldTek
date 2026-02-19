import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Check,
  Users,
  Briefcase,
  Crown,
  Zap,
  ArrowRight,
  Calendar,
  HardDrive,
  Bot,
  Loader2,
  ExternalLink,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import { StripeConnectSettings } from "./StripeConnectSettings";
import { TIER_CONFIG, UPGRADE_PATH, SubscriptionTier } from "@/config/pricing";

export function BillingSettings() {
  const { tenant } = useTenant();
  const [isYearly, setIsYearly] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [skipTrial, setSkipTrial] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // Check for success/canceled URL params
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({
        title: "Subscription Updated!",
        description: "Your subscription has been successfully updated. Changes may take a moment to reflect.",
      });
      // Refresh subscription status
      queryClient.invalidateQueries({ queryKey: ["stripe-subscription"] });
    } else if (searchParams.get("canceled") === "true") {
      toast({
        title: "Checkout Canceled",
        description: "Your subscription upgrade was canceled.",
        variant: "destructive",
      });
    }
  }, [searchParams, toast, queryClient]);

  // Fetch Stripe subscription status
  const { data: stripeStatus, isLoading: isLoadingStripe, refetch: refetchStripe } = useQuery({
    queryKey: ["stripe-subscription"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;

      const { data, error } = await supabase.functions.invoke("check-subscription", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      return data as { 
        subscribed: boolean; 
        tier: string; 
        subscription_end: string | null;
        stripe_customer_id: string | null;
        is_trialing: boolean;
        trial_end: string | null;
      };
    },
    staleTime: 30000,
  });

  const currentTier = (stripeStatus?.tier as SubscriptionTier) || 
    (tenant?.subscription_tier as SubscriptionTier) || "trial";
  const tierConfig = TIER_CONFIG[currentTier];
  const TierIcon = tierConfig.icon;

  // Fetch usage stats
  const { data: usageStats } = useQuery({
    queryKey: ["billing-usage", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const { count: techCount } = await supabase
        .from("tenant_users")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("role", "technician")
        .eq("is_active", true);

      const { count: jobsThisMonth } = await supabase
        .from("scheduled_jobs")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .gte("created_at", startOfMonth.toISOString());

      const { data: docs } = await supabase
        .from("documents")
        .select("file_size")
        .eq("tenant_id", tenant.id);

      const storageUsed = docs?.reduce((acc, doc) => acc + (doc.file_size || 0), 0) || 0;

      const { count: aiConversations } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .gte("created_at", startOfMonth.toISOString());

      return {
        technicians: techCount || 0,
        jobsThisMonth: jobsThisMonth || 0,
        storageUsed,
        aiConversations: aiConversations || 0,
      };
    },
    enabled: !!tenant?.id,
  });

  const trialEndsAt = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const daysRemaining = trialEndsAt ? differenceInDays(trialEndsAt, new Date()) : 0;
  const isTrialing = tenant?.subscription_status === "trial" && daysRemaining > 0 && !stripeStatus?.subscribed;

  const currentTierIndex = UPGRADE_PATH.indexOf(currentTier);
  const upgradeTiers = UPGRADE_PATH.slice(currentTierIndex + 1).filter(t => t !== "enterprise");

  const jobsLimit = typeof tierConfig.jobsPerMonth === "number" ? tierConfig.jobsPerMonth : null;
  const jobsUsedPercent = jobsLimit && usageStats
    ? Math.min((usageStats.jobsThisMonth / jobsLimit) * 100, 100)
    : 0;

  const techsLimit = typeof tierConfig.includedTechs === "number" ? tierConfig.includedTechs : null;

  const handleUpgrade = async (tier: SubscriptionTier) => {
    const stripeTier = TIER_CONFIG[tier].stripeTier;
    if (!stripeTier) return;

    setIsLoading(tier);

    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    // Stripe Checkout can’t render inside an iframe (like the preview). If embedded, open a new tab.
    const checkoutWindow = inIframe ? window.open("about:blank", "_blank") : null;
    try {
      // Safety: if we did open a window, prevent it from accessing the opener.
      try {
        if (checkoutWindow) checkoutWindow.opener = null;
      } catch {
        // ignore
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Please log in to upgrade your subscription");
      }

      const invokePromise = supabase.functions.invoke("create-checkout", {
        body: { 
          tier: stripeTier, 
          skip_trial: skipTrial,
          billing_period: isYearly ? "yearly" : "monthly",
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const { data, error } = (await Promise.race([
        invokePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Checkout is taking too long. Please try again.")), 20000)
        ),
      ])) as Awaited<typeof invokePromise>;

      if (error) throw error;

      const url: string | undefined = data?.url;
      if (url) {
        if (checkoutWindow && !checkoutWindow.closed) {
          checkoutWindow.location.href = url;
          checkoutWindow.focus?.();
        } else {
          // Fallback (e.g., popup blocked or restricted navigation in embedded previews)
          try {
            window.top?.location.assign(url);
          } catch {
            window.location.assign(url);
          }
        }
        return;
      }

      if (data?.error) throw new Error(data.error);
      throw new Error("No checkout URL received from server");
    } catch (error) {
      if (checkoutWindow && !checkoutWindow.closed) checkoutWindow.close();

      console.error("Checkout error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start checkout",
        variant: "destructive",
      });
      setIsLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoading("portal");

    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    // Stripe portal can’t render inside an iframe (like the preview). If embedded, open a new tab.
    const portalWindow = inIframe ? window.open("about:blank", "_blank") : null;
    try {
      try {
        if (portalWindow) portalWindow.opener = null;
      } catch {
        // ignore
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Please log in to manage your subscription");
      }

      const invokePromise = supabase.functions.invoke("customer-portal", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const { data, error } = (await Promise.race([
        invokePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Opening the billing portal is taking too long. Please try again.")), 20000)
        ),
      ])) as Awaited<typeof invokePromise>;

      if (error) throw error;

      const url: string | undefined = data?.url;
      if (url) {
        if (portalWindow && !portalWindow.closed) {
          portalWindow.location.href = url;
          portalWindow.focus?.();
        } else {
          try {
            window.top?.location.assign(url);
          } catch {
            window.location.assign(url);
          }
        }
        return;
      }

      throw new Error("No portal URL received from server");
    } catch (error) {
      if (portalWindow && !portalWindow.closed) portalWindow.close();

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to open billing portal",
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stripe Connect for Customer Payments */}
      <StripeConnectSettings />
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex flex-wrap items-center gap-2">
                Current Plan
                <Badge className={cn(tierConfig.color)}>
                  <TierIcon className="h-3 w-3 mr-1" />
                  {tierConfig.name}
                </Badge>
                {stripeStatus?.is_trialing && (
                  <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50">
                    14-Day Free Trial
                  </Badge>
                )}
                {isLoadingStripe && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {stripeStatus?.is_trialing && stripeStatus?.trial_end ? (
                  <span className="text-emerald-600 font-medium">
                    🎉 Free trial ends {format(new Date(stripeStatus.trial_end), "MMM d, yyyy")} ({differenceInDays(new Date(stripeStatus.trial_end), new Date())} days remaining)
                  </span>
                ) : isTrialing ? (
                  <span className="text-amber-600">
                    Trial ends in {daysRemaining} days ({trialEndsAt && format(trialEndsAt, "MMM d, yyyy")})
                  </span>
                ) : stripeStatus?.subscription_end ? (
                  <span>
                    Renews on {format(new Date(stripeStatus.subscription_end), "MMM d, yyyy")}
                  </span>
                ) : (
                  `Your organization is on the ${tierConfig.name} plan`
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetchStripe()}
                disabled={isLoadingStripe}
              >
                <RefreshCw className={cn("h-4 w-4", isLoadingStripe && "animate-spin")} />
              </Button>
              {tierConfig.monthlyPrice !== null && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">
                    ${isYearly ? tierConfig.yearlyPrice : tierConfig.monthlyPrice}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  {isYearly && (
                    <p className="text-xs text-muted-foreground">Billed annually</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-sm">Technicians</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {usageStats?.technicians || 0}
                <span className="text-sm font-normal text-muted-foreground">
                  /{techsLimit || "∞"}
                </span>
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Briefcase className="h-4 w-4" />
                <span className="text-sm">Jobs/Month</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {usageStats?.jobsThisMonth || 0}
                <span className="text-sm font-normal text-muted-foreground">
                  /{jobsLimit || "∞"}
                </span>
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <HardDrive className="h-4 w-4" />
                <span className="text-sm">Storage</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {formatBytes(usageStats?.storageUsed || 0)}
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Bot className="h-4 w-4" />
                <span className="text-sm">AI Chats</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {usageStats?.aiConversations || 0}
              </p>
            </div>
          </div>

          {jobsLimit && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Jobs usage this month</span>
                <span className="font-medium">
                  {usageStats?.jobsThisMonth || 0} / {jobsLimit}
                </span>
              </div>
              <Progress 
                value={jobsUsedPercent} 
                className={cn(
                  "h-2",
                  jobsUsedPercent > 80 && "bg-amber-100 [&>div]:bg-amber-500",
                  jobsUsedPercent > 95 && "bg-red-100 [&>div]:bg-red-500"
                )}
              />
              {jobsUsedPercent > 80 && (
                <p className="text-xs text-amber-600">
                  You're approaching your monthly job limit. Consider upgrading.
                </p>
              )}
            </div>
          )}

          {/* Manage Subscription Button */}
          {stripeStatus?.subscribed && (
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={isLoading === "portal"}
              className="w-full sm:w-auto"
            >
              {isLoading === "portal" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Manage Subscription
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Upgrade Options */}
      {upgradeTiers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Upgrade Your Plan</CardTitle>
                <CardDescription>
                  Unlock more features and increase your limits
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={cn("text-sm", !isYearly ? "font-medium" : "text-muted-foreground")}>
                  Monthly
                </span>
                <Switch checked={isYearly} onCheckedChange={setIsYearly} />
                <span className={cn("text-sm", isYearly ? "font-medium" : "text-muted-foreground")}>
                  Yearly
                </span>
                {isYearly && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    Save 20%
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Skip Trial Option */}
            <div className="flex items-center space-x-2 mb-6 p-3 rounded-lg bg-muted/50 border">
              <Checkbox 
                id="skip-trial" 
                checked={skipTrial} 
                onCheckedChange={(checked) => setSkipTrial(!!checked)} 
              />
              <label 
                htmlFor="skip-trial" 
                className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Skip 14-day free trial and start billing immediately
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {upgradeTiers.map((tier) => {
                const config = TIER_CONFIG[tier];
                const Icon = config.icon;
                const isRecommended = tier === "growth";

                return (
                  <div
                    key={tier}
                    className={cn(
                      "relative border rounded-xl p-5 transition-all hover:border-primary/50",
                      isRecommended && "border-primary shadow-md"
                    )}
                  >
                    {isRecommended && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">
                          Recommended
                        </Badge>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      <div className={cn("p-2 rounded-lg", config.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="font-semibold text-foreground">{config.name}</h3>
                    </div>

                    <div className="mb-4">
                      <span className="text-3xl font-bold text-foreground">
                        ${isYearly ? config.yearlyPrice : config.monthlyPrice}
                      </span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>

                    <ul className="space-y-2 mb-5 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span>{config.includedTechs} technicians included</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span>
                          {typeof config.jobsPerMonth === "number"
                            ? `${config.jobsPerMonth} jobs/month`
                            : "Unlimited jobs"}
                        </span>
                      </li>
                      {tier === "growth" && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span>AI Field Assistant</span>
                        </li>
                      )}
                      {tier === "professional" && (
                        <>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-primary" />
                            <span>Custom workflows</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-primary" />
                            <span>API access</span>
                          </li>
                        </>
                      )}
                    </ul>

                    <Button
                      className="w-full"
                      variant={isRecommended ? "default" : "outline"}
                      onClick={() => handleUpgrade(tier)}
                      disabled={isLoading === tier}
                    >
                      {isLoading === tier ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      {skipTrial ? `Upgrade to ${config.name}` : `Start ${config.name} Trial`}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enterprise Contact */}
      <Card className="bg-gradient-to-br from-muted/50 to-muted border-dashed">
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10">
              <Crown className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Need Enterprise features?</h3>
              <p className="text-sm text-muted-foreground">
                White-label branding, custom integrations, SLA guarantees & more
              </p>
            </div>
          </div>
          <Button variant="outline">Contact Sales</Button>
        </CardContent>
      </Card>

      {/* Billing Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-foreground">Next billing date</p>
              <p className="text-sm text-muted-foreground">
                {stripeStatus?.subscription_end
                  ? format(new Date(stripeStatus.subscription_end), "MMMM d, yyyy")
                  : isTrialing
                  ? `Trial ends ${trialEndsAt && format(trialEndsAt, "MMMM d, yyyy")}`
                  : "No active subscription"}
              </p>
            </div>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-foreground">Payment method</p>
              <p className="text-sm text-muted-foreground">
                {stripeStatus?.subscribed
                  ? "Managed via Stripe"
                  : "No payment method on file"}
              </p>
            </div>
            {stripeStatus?.subscribed ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleManageSubscription}
                disabled={isLoading === "portal"}
              >
                {isLoading === "portal" && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                Update
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleUpgrade("starter")}
                disabled={!!isLoading}
              >
                Add Payment Method
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
