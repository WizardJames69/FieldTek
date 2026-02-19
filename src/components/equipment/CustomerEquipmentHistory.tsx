import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { ChevronDown, Wrench, Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface Equipment {
  id: string;
  equipment_type: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  install_date: string | null;
  warranty_expiry: string | null;
  warranty_type: string | null;
  status: string | null;
}

interface CustomerEquipmentHistoryProps {
  clientId: string;
  clientName?: string;
  defaultOpen?: boolean;
}

export function CustomerEquipmentHistory({ 
  clientId, 
  clientName,
  defaultOpen = false 
}: CustomerEquipmentHistoryProps) {
  const { tenant } = useTenant();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const { data: equipment, isLoading } = useQuery({
    queryKey: ['customer-equipment', clientId],
    queryFn: async () => {
      if (!clientId || !tenant?.id) return [];

      const { data, error } = await supabase
        .from('equipment_registry')
        .select('*')
        .eq('client_id', clientId)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Equipment[];
    },
    enabled: isOpen && !!clientId && !!tenant?.id,
  });

  const getWarrantyStatus = (warrantyExpiry: string | null): { 
    label: string; 
    color: string; 
    bgColor: string;
    icon: React.ReactNode;
  } => {
    if (!warrantyExpiry) {
      return { 
        label: 'Unknown', 
        color: 'text-muted-foreground', 
        bgColor: 'bg-muted',
        icon: null
      };
    }

    const expiryDate = new Date(warrantyExpiry);
    const today = new Date();
    const daysUntilExpiry = differenceInDays(expiryDate, today);

    if (daysUntilExpiry < 0) {
      return { 
        label: 'Expired', 
        color: 'text-destructive', 
        bgColor: 'bg-destructive/10',
        icon: <AlertTriangle className="h-3 w-3" />
      };
    } else if (daysUntilExpiry <= 30) {
      return { 
        label: 'Expiring Soon', 
        color: 'text-orange-600 dark:text-orange-400', 
        bgColor: 'bg-orange-500/10',
        icon: <AlertTriangle className="h-3 w-3" />
      };
    } else {
      return { 
        label: 'Active', 
        color: 'text-green-600 dark:text-green-400', 
        bgColor: 'bg-green-500/10',
        icon: <Shield className="h-3 w-3" />
      };
    }
  };

  const getWarrantyTypeLabel = (type: string | null): string => {
    if (!type) return '';
    const labels: Record<string, string> = {
      standard: '1 Year',
      extended: '3 Year',
      premium: '5 Year',
      lifetime: '25 Year',
    };
    return labels[type] || type;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">
              Equipment History
              {clientName && <span className="text-muted-foreground"> - {clientName}</span>}
            </span>
            {equipment && equipment.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {equipment.length}
              </Badge>
            )}
          </div>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !equipment || equipment.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center">
              <Wrench className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No equipment registered for this customer</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {equipment.map((eq) => {
              const warrantyStatus = getWarrantyStatus(eq.warranty_expiry);

              return (
                <Card key={eq.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-sm">{eq.equipment_type}</h4>
                          <Badge variant="outline" className="text-xs">
                            {eq.status || 'Active'}
                          </Badge>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {eq.brand && (
                            <div>
                              <span className="text-muted-foreground/70">Brand:</span>{' '}
                              <span className="text-foreground">{eq.brand}</span>
                            </div>
                          )}
                          {eq.model && (
                            <div>
                              <span className="text-muted-foreground/70">Model:</span>{' '}
                              <span className="text-foreground">{eq.model}</span>
                            </div>
                          )}
                          {eq.serial_number && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground/70">S/N:</span>{' '}
                              <span className="text-foreground font-mono">{eq.serial_number}</span>
                            </div>
                          )}
                          {eq.install_date && (
                            <div>
                              <span className="text-muted-foreground/70">Installed:</span>{' '}
                              <span className="text-foreground">
                                {format(new Date(eq.install_date), 'MMM d, yyyy')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Warranty Badge */}
                      <div className="shrink-0">
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            'flex items-center gap-1 text-xs',
                            warrantyStatus.bgColor,
                            warrantyStatus.color
                          )}
                        >
                          {warrantyStatus.icon}
                          {warrantyStatus.label}
                        </Badge>
                        {eq.warranty_expiry && (
                          <p className="text-[10px] text-muted-foreground text-right mt-1">
                            {warrantyStatus.label === 'Expired' ? 'Expired' : 'Expires'}{' '}
                            {format(new Date(eq.warranty_expiry), 'MMM yyyy')}
                          </p>
                        )}
                        {eq.warranty_type && (
                          <p className="text-[10px] text-muted-foreground text-right">
                            {getWarrantyTypeLabel(eq.warranty_type)}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
