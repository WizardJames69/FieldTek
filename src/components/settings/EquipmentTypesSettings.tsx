import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useTenantSettings } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function EquipmentTypesSettings() {
  const { tenant } = useTenant();
  const settings = useTenantSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newType, setNewType] = useState('');

  const equipmentTypes = (settings?.equipment_types as string[]) || [];

  const updateMutation = useMutation({
    mutationFn: async (types: string[]) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await supabase
        .from('tenant_settings')
        .update({ equipment_types: types })
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Equipment types updated' });
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

  const addType = () => {
    if (!newType.trim()) return;
    if (equipmentTypes.includes(newType.trim())) {
      toast({
        title: 'Type already exists',
        variant: 'destructive',
      });
      return;
    }
    updateMutation.mutate([...equipmentTypes, newType.trim()]);
    setNewType('');
  };

  const removeType = (type: string) => {
    updateMutation.mutate(equipmentTypes.filter((t) => t !== type));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipment Types</CardTitle>
        <CardDescription>
          Define the types of equipment you service
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Add equipment type..."
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addType())}
          />
          <Button onClick={addType} disabled={updateMutation.isPending || !newType.trim()}>
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {equipmentTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No equipment types configured</p>
          ) : (
            equipmentTypes.map((type) => (
              <Badge key={type} variant="secondary" className="gap-1 pr-1">
                {type}
                <button
                  onClick={() => removeType(type)}
                  className="ml-1 h-4 w-4 rounded-full hover:bg-destructive/20 flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
