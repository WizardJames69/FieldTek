import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useTenantSettings } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PushNotificationToggle } from '@/components/notifications/PushNotificationToggle';

function InvoiceReminderToggle() {
  const { tenant } = useTenant();
  const settings = useTenantSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local truth after first interaction: TenantContext holds settings in
  // plain state (not react-query), so the context value stays stale until a
  // full reload — binding the switch straight to it would snap the toggle
  // back after a successful save.
  const [enabled, setEnabled] = useState(settings?.invoice_reminders_enabled ?? false);

  const updateMutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { error } = await supabase
        .from('tenant_settings')
        .update({ invoice_reminders_enabled: next })
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      toast({
        title: next ? 'Invoice reminders on' : 'Invoice reminders off',
        description: next
          ? 'Customers with overdue invoices will be emailed a payment reminder each day.'
          : 'No automated reminder emails will be sent.',
      });
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
    onError: (error, next) => {
      setEnabled(!next);
      toast({
        title: 'Failed to save',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor="invoice-reminders-switch" className="text-sm font-medium">
          Automated overdue reminders
        </Label>
        <p className="text-sm text-muted-foreground">
          Once a day, FieldTek emails each of your customers with an overdue
          invoice a payment reminder. Off by default — nothing is sent to your
          customers until you turn this on.
        </p>
      </div>
      <Switch
        id="invoice-reminders-switch"
        data-testid="invoice-reminders-toggle"
        checked={enabled}
        disabled={updateMutation.isPending}
        onCheckedChange={(next) => {
          setEnabled(next);
          updateMutation.mutate(next);
        }}
      />
    </div>
  );
}

export function NotificationSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Control how you receive real-time alerts about jobs, invoices, and service requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PushNotificationToggle variant="card" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invoice Reminders
          </CardTitle>
          <CardDescription>
            Automatic payment-reminder emails to your customers for overdue invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceReminderToggle />
        </CardContent>
      </Card>
    </div>
  );
}
