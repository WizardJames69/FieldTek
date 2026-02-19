import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useTenantSettings } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Feature {
  key: string;
  label: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    key: 'enable_invoicing',
    label: 'Invoicing',
    description: 'Generate and manage invoices for completed jobs',
  },
  {
    key: 'enable_scheduling',
    label: 'Scheduling',
    description: 'Calendar-based job scheduling and dispatch',
  },
  {
    key: 'enable_documents',
    label: 'Documents Library',
    description: 'Upload and organize manuals and reference materials',
  },
  {
    key: 'enable_ai_assistant',
    label: 'AI Assistant',
    description: 'AI-powered field support for technicians',
  },
];

export function FeatureSettings() {
  const { tenant } = useTenant();
  const settings = useTenantSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const features = (settings?.features_enabled as Record<string, boolean>) || {};

  const updateMutation = useMutation({
    mutationFn: async (updatedFeatures: Record<string, boolean>) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await supabase
        .from('tenant_settings')
        .update({ features_enabled: updatedFeatures })
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Features updated' });
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleFeature = (key: string, enabled: boolean) => {
    updateMutation.mutate({
      ...features,
      [key]: enabled,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Features</CardTitle>
        <CardDescription>
          Enable or disable platform features for your organization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {FEATURES.map((feature) => (
          <div key={feature.key} className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={feature.key} className="font-medium">
                {feature.label}
              </Label>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
            <Switch
              id={feature.key}
              checked={features[feature.key] ?? true}
              onCheckedChange={(checked) => toggleFeature(feature.key, checked)}
              disabled={updateMutation.isPending}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
