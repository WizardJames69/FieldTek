import { ReactNode } from "react";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { AlertTriangle, CreditCard } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface SubscriptionGuardProps {
  children: ReactNode;
  /** If true, past_due users are also blocked (default: false) */
  blockPastDue?: boolean;
}

export function SubscriptionGuard({ children, blockPastDue = false }: SubscriptionGuardProps) {
  const { isStatusBlocked, isPastDue } = useFeatureAccess();
  const { loading } = useTenant();

  if (loading) {
    return (
      <div className="min-h-screen p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isStatusBlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mb-6">
          <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Subscription Required
        </h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Your subscription has ended or your trial has expired. Please subscribe
          to a plan to continue using this feature.
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link to="/settings?tab=billing">
              <CreditCard className="h-4 w-4 mr-2" />
              View Plans
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (blockPastDue && isPastDue) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center mb-6">
          <CreditCard className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Payment Past Due
        </h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Your subscription payment has failed. Please update your payment method
          to continue.
        </p>
        <Button asChild>
          <Link to="/settings?tab=billing">
            <CreditCard className="h-4 w-4 mr-2" />
            Update Payment
          </Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
