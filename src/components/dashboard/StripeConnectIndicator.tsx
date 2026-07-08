import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTenant, useUserRole } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { PAYMENT_COLLECTION_ENABLED } from '@/config/payments';

export function StripeConnectIndicator() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { isAdmin, isOwner } = useUserRole();

  const { data: stripeStatus, isLoading } = useQuery({
    queryKey: ['stripe-connect-status-dashboard', tenant?.id],
    queryFn: async () => {
      // Guard inside the queryFn too: refetch() bypasses `enabled`, and the
      // function always errors while fgem has no Stripe secrets.
      if (!PAYMENT_COLLECTION_ENABLED) return null;
      if (!tenant?.id) return null;

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;

      const { data, error } = await supabase.functions.invoke('stripe-connect-status', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (error) {
        console.error('Error fetching Stripe Connect status:', error);
        return null;
      }

      return data;
    },
    enabled: PAYMENT_COLLECTION_ENABLED && !!tenant?.id && (isAdmin || isOwner),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Design Partner Alpha: payment collection disabled — no Connect nudge and
  // no failing stripe-connect-status calls. See src/config/payments.ts.
  if (!PAYMENT_COLLECTION_ENABLED) return null;

  // Only show for admins/owners
  if (!isAdmin && !isOwner) return null;

  if (isLoading || !stripeStatus) return null;

  const status = stripeStatus.status;
  const isConnected = status === 'connected';
  const isPending = status === 'pending' || status === 'restricted';
  const isNotConnected = status === 'not_connected';

  // Don't show if already connected
  if (isConnected) return null;

  return (
    <Card className={cn(
      "border-l-4",
      isPending ? "border-l-warning bg-warning/5" : "border-l-muted bg-muted/30"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full",
              isPending ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
            )}>
              {isPending ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <CreditCard className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">Payment Setup</p>
                <Badge variant="outline" className={cn(
                  "text-xs",
                  isPending ? "border-warning text-warning" : "border-muted-foreground text-muted-foreground"
                )}>
                  {isPending ? 'Incomplete' : 'Not Connected'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isPending 
                  ? 'Complete your Stripe setup to accept invoice payments'
                  : 'Connect Stripe to accept online invoice payments'
                }
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={isPending ? "default" : "outline"}
            onClick={() => navigate('/settings?tab=billing')}
            className="shrink-0"
          >
            {isPending ? 'Complete Setup' : 'Connect'}
            <ExternalLink className="ml-1.5 h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
