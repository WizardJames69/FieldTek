import { AlertTriangle, CreditCard, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useTenant } from "@/contexts/TenantContext";
import { format, differenceInDays } from "date-fns";

export function SubscriptionStatusBanner() {
  const { tenant } = useTenant();
  const { isPastDue, isStatusBlocked, cancelAtPeriodEnd } = useFeatureAccess();

  if (!tenant) return null;

  // Cancel at period end -- warning (not blocking)
  if (cancelAtPeriodEnd && !isPastDue && !isStatusBlocked) {
    const cancelAt = tenant.cancel_at ? new Date(tenant.cancel_at) : null;
    const daysLeft = cancelAt ? differenceInDays(cancelAt, new Date()) : null;

    return (
      <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
        <div className="flex items-center gap-3 max-w-screen-xl mx-auto">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Your subscription is set to cancel
              {cancelAt && ` on ${format(cancelAt, "MMM d, yyyy")}`}
              {daysLeft !== null && daysLeft >= 0 && ` (${daysLeft} days remaining)`}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Reactivate from the billing portal to keep your plan.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            asChild
            className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
          >
            <Link to="/settings?tab=billing">Manage Subscription</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Past due -- urgent warning
  if (isPastDue) {
    return (
      <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 px-4 py-3">
        <div className="flex items-center gap-3 max-w-screen-xl mx-auto">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Your subscription payment is past due
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              Please update your payment method. You cannot create new jobs or add
              technicians until payment is resolved.
            </p>
          </div>
          <Button size="sm" variant="destructive" asChild>
            <Link to="/settings?tab=billing">
              <CreditCard className="h-4 w-4 mr-1" />
              Update Payment
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Canceled/expired -- blocking
  if (isStatusBlocked) {
    return (
      <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 px-4 py-3">
        <div className="flex items-center gap-3 max-w-screen-xl mx-auto">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Your subscription has ended
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              Please resubscribe to regain access to your workspace features.
            </p>
          </div>
          <Button size="sm" variant="destructive" asChild>
            <Link to="/settings?tab=billing">Resubscribe</Link>
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
