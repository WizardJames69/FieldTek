import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Building2,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ConnectStatus {
  connected: boolean;
  status: "not_connected" | "pending" | "connected" | "restricted";
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements?: string[];
  onboardedAt?: string;
}

export function StripeConnectSettings() {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // Check for URL params from Stripe redirect
  useEffect(() => {
    const connectStatus = searchParams.get("stripe_connect");
    
    if (connectStatus === "complete") {
      toast({
        title: "Stripe Setup Complete!",
        description: "Your Stripe account is now connected. You can accept customer payments.",
      });
      queryClient.invalidateQueries({ queryKey: ["stripe-connect-status"] });
    } else if (connectStatus === "refresh") {
      toast({
        title: "Setup Incomplete",
        description: "Please complete your Stripe account setup to accept payments.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["stripe-connect-status"] });
    }
  }, [searchParams, toast, queryClient]);

  // Fetch Connect status
  const { data: connectStatus, isLoading, refetch } = useQuery<ConnectStatus>({
    queryKey: ["stripe-connect-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return { connected: false, status: "not_connected", accountId: null, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false };
      }

      const { data, error } = await supabase.functions.invoke("stripe-connect-status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      return data;
    },
    staleTime: 30000,
  });

  const handleConnect = async () => {
    setIsConnecting(true);

    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    const connectWindow = inIframe ? window.open("about:blank", "_blank") : null;
    
    try {
      if (connectWindow) connectWindow.opener = null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Please log in to connect your Stripe account");
      }

      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      if (data?.url) {
        if (connectWindow && !connectWindow.closed) {
          connectWindow.location.href = data.url;
          connectWindow.focus?.();
        } else {
          try {
            window.top?.location.assign(data.url);
          } catch {
            window.location.assign(data.url);
          }
        }
        return;
      }

      if (data?.status === "connected") {
        toast({
          title: "Already Connected",
          description: data.message || "Your Stripe account is already connected.",
        });
        refetch();
        return;
      }

      throw new Error("No onboarding URL received");
    } catch (error) {
      if (connectWindow && !connectWindow.closed) connectWindow.close();
      
      console.error("Connect error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start Stripe setup",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const getStatusDisplay = () => {
    if (!connectStatus) return null;

    switch (connectStatus.status) {
      case "connected":
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Setup Incomplete
          </Badge>
        );
      case "restricted":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Restricted
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            Not Connected
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Accept Customer Payments
                {getStatusDisplay()}
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardTitle>
              <CardDescription>
                Connect your Stripe account to receive payments directly from customers
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {connectStatus?.status === "connected" ? (
          <>
            <Alert className="border-success/20 bg-success/5">
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                Your Stripe account is connected! Customers can now pay invoices directly through your customer portal.
                {connectStatus.onboardedAt && (
                  <span className="block mt-1 text-muted-foreground text-sm">
                    Connected on {format(new Date(connectStatus.onboardedAt), "MMMM d, yyyy")}
                  </span>
                )}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Charges</span>
                </div>
                <p className={cn(
                  "font-medium",
                  connectStatus.chargesEnabled ? "text-success" : "text-destructive"
                )}>
                  {connectStatus.chargesEnabled ? "Enabled" : "Disabled"}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Payouts</span>
                </div>
                <p className={cn(
                  "font-medium",
                  connectStatus.payoutsEnabled ? "text-success" : "text-destructive"
                )}>
                  {connectStatus.payoutsEnabled ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open("https://dashboard.stripe.com", "_blank")}
            >
              Open Stripe Dashboard
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </>
        ) : connectStatus?.status === "pending" ? (
          <>
            <Alert className="border-warning/20 bg-warning/5">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning">
                Your Stripe account setup is incomplete. Please complete the onboarding process to accept payments.
                {connectStatus.requirements && connectStatus.requirements.length > 0 && (
                  <span className="block mt-2 text-sm text-muted-foreground">
                    Remaining items: {connectStatus.requirements.join(", ")}
                  </span>
                )}
              </AlertDescription>
            </Alert>
            
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Complete Stripe Setup
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        ) : connectStatus?.status === "restricted" ? (
          <>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your Stripe account has restrictions. Please visit your Stripe dashboard to resolve any issues.
              </AlertDescription>
            </Alert>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open("https://dashboard.stripe.com", "_blank")}
            >
              Open Stripe Dashboard
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </>
        ) : (
          <>
            <div className="p-4 rounded-lg border border-dashed bg-muted/30">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-primary/10 mt-0.5">
                  <CreditCard className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-foreground mb-1">Enable Online Payments</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Connect your Stripe account to let customers pay invoices directly through your customer portal. 
                    A 2% platform fee applies to each payment.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      Customers pay securely via Stripe Checkout
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      Funds deposited directly to your bank account
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      Invoices automatically marked as paid
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full"
              size="lg"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4 mr-2" />
              )}
              Connect Stripe Account
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
