import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Wrench, Calendar, Shield, AlertTriangle, CheckCircle, Info, Clock, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, isPast, addDays, isWithinInterval } from 'date-fns';
import { PortalAuthGuard } from '@/components/portal/PortalAuthGuard';

export default function PortalEquipment() {
  const { client, loading: authLoading, clientLoading, user } = usePortalAuth();
  const navigate = useNavigate();
  const [expandedEquipment, setExpandedEquipment] = useState<string | null>(null);

  const { data: equipment, isLoading } = useQuery({
    queryKey: ['portal-equipment', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];

      const { data } = await supabase
        .from('equipment_registry')
        .select(`
          id,
          equipment_type,
          brand,
          model,
          serial_number,
          status,
          install_date,
          warranty_expiry,
          warranty_type,
          location_notes,
          specifications
        `)
        .eq('client_id', client.id)
        .order('equipment_type', { ascending: true });

      return data || [];
    },
    enabled: !!client?.id,
  });

  // Fetch service history for expanded equipment
  const { data: serviceHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['portal-equipment-history', expandedEquipment],
    queryFn: async () => {
      if (!expandedEquipment) return [];

      const { data } = await supabase
        .from('scheduled_jobs')
        .select(`
          id,
          title,
          job_type,
          status,
          scheduled_date,
          description,
          notes
        `)
        .eq('equipment_id', expandedEquipment)
        .order('scheduled_date', { ascending: false })
        .limit(10);

      return data || [];
    },
    enabled: !!expandedEquipment,
  });

  const getWarrantyStatus = (expiryDate: string | null) => {
    if (!expiryDate) {
      return { status: 'unknown', label: 'Unknown', variant: 'secondary' as const };
    }

    const expiry = new Date(expiryDate);
    const now = new Date();
    const warningDate = addDays(now, 30);

    if (isPast(expiry)) {
      return { status: 'expired', label: 'Expired', variant: 'destructive' as const };
    }
    if (isWithinInterval(expiry, { start: now, end: warningDate })) {
      return { status: 'expiring', label: 'Expiring Soon', variant: 'secondary' as const };
    }
    return { status: 'active', label: 'Active', variant: 'outline' as const };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'needs_service':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'inactive':
        return <Info className="h-4 w-4 text-muted-foreground" />;
      default:
        return <CheckCircle className="h-4 w-4 text-success" />;
    }
  };

  const getJobStatusBadge = (status: string | null) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Scheduled' },
      in_progress: { variant: 'default', label: 'In Progress' },
      completed: { variant: 'outline', label: 'Completed' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
    };
    const config = variants[status || 'pending'] || { variant: 'secondary', label: status || 'Unknown' };
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  const activeCount = equipment?.filter(e => e.status === 'active').length || 0;
  const warrantyExpiringCount = equipment?.filter(e => {
    const { status } = getWarrantyStatus(e.warranty_expiry);
    return status === 'expiring';
  }).length || 0;

  const toggleEquipment = (id: string) => {
    setExpandedEquipment(prev => prev === id ? null : id);
  };

  const handleRequestService = (item: typeof equipment[0]) => {
    const params = new URLSearchParams({
      equipment_id: item.id,
      equipment_type: item.equipment_type || '',
      brand: item.brand || '',
      model: item.model || '',
      serial: item.serial_number || '',
    });
    navigate(`/portal/request?${params.toString()}`);
  };

  return (
    <PortalAuthGuard>
    <PortalLayout>
      <div className="space-y-6">
        <div className="page-header-glass rounded-xl p-4 md:p-6 bg-background/60 backdrop-blur-xl border border-border/30">
          <h1 className="text-2xl font-bold font-display">My Equipment</h1>
          <p className="text-muted-foreground">View all equipment registered to your account</p>
        </div>

        {/* Summary Cards with 3D effect */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card variant="elevated" glow="primary" className="metric-card-glow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Equipment</p>
                  <p className="text-2xl font-bold font-display">{equipment?.length || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-[0_0_15px_hsl(var(--primary)/0.2)]">
                  <Wrench className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" glow="success" className="metric-card-glow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold font-display text-success">{activeCount}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center shadow-[0_0_15px_hsl(var(--success)/0.2)]">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" glow="warning" className="metric-card-glow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Warranty Expiring</p>
                  <p className="text-2xl font-bold font-display text-warning">{warrantyExpiringCount}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center shadow-[0_0_15px_hsl(var(--warning)/0.2)]">
                  <Shield className="h-6 w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Equipment Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : equipment?.length === 0 ? (
          <Card variant="glass">
            <CardContent className="flex flex-col items-center justify-center py-12 empty-state-native">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Wrench className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No equipment registered</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {equipment?.map(item => {
              const warrantyInfo = getWarrantyStatus(item.warranty_expiry);
              const isExpanded = expandedEquipment === item.id;
              
              return (
                <Collapsible key={item.id} open={isExpanded} onOpenChange={() => toggleEquipment(item.id)}>
                  <Card variant="interactive" glow="primary" className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Wrench className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{item.equipment_type}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {item.brand} {item.model}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(item.status || 'active')}
                          <span className="text-xs text-muted-foreground capitalize">
                            {item.status?.replace('_', ' ') || 'Active'}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {item.serial_number && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Serial Number</span>
                            <span className="font-mono">{item.serial_number}</span>
                          </div>
                        )}

                        {item.install_date && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Installed
                            </span>
                            <span>{format(new Date(item.install_date), 'MMM d, yyyy')}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            Warranty
                          </span>
                          <div className="flex items-center gap-2">
                            {item.warranty_expiry ? (
                              <>
                                <span>{format(new Date(item.warranty_expiry), 'MMM d, yyyy')}</span>
                                <Badge variant={warrantyInfo.variant} className="text-xs">
                                  {warrantyInfo.label}
                                </Badge>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Not specified</span>
                            )}
                          </div>
                        </div>

                        {item.location_notes && (
                          <div className="pt-2 border-t">
                            <p className="text-xs text-muted-foreground">Location</p>
                            <p className="text-sm">{item.location_notes}</p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-3">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="flex-1">
                              <Clock className="h-4 w-4 mr-2" />
                              Service History
                              {isExpanded ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
                            </Button>
                          </CollapsibleTrigger>
                          <Button 
                            variant="default" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRequestService(item);
                            }}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Request Service
                          </Button>
                        </div>
                      </div>

                      <CollapsibleContent>
                        <div className="mt-4 pt-4 border-t space-y-3">
                          <h4 className="text-sm font-medium">Recent Service History</h4>
                          {historyLoading ? (
                            <div className="space-y-2">
                              {[1, 2].map(i => (
                                <Skeleton key={i} className="h-16 w-full" />
                              ))}
                            </div>
                          ) : serviceHistory && serviceHistory.length > 0 ? (
                            <div className="space-y-2">
                              {serviceHistory.map(job => (
                                <div key={job.id} className="p-3 bg-muted/50 rounded-lg">
                                  <div className="flex items-start justify-between mb-1">
                                    <p className="text-sm font-medium">{job.title}</p>
                                    {getJobStatusBadge(job.status)}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {job.scheduled_date ? format(new Date(job.scheduled_date), 'MMM d, yyyy') : 'Unscheduled'}
                                    {job.job_type && (
                                      <>
                                        <span>•</span>
                                        <span>{job.job_type}</span>
                                      </>
                                    )}
                                  </div>
                                  {job.notes && (
                                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{job.notes}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No service history for this equipment
                            </p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </CardContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </PortalLayout>
    </PortalAuthGuard>
  );
}