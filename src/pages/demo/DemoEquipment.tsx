import { useState } from 'react';
import { format } from 'date-fns';
import {
  Wrench,
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useDemoSandbox } from '@/contexts/DemoSandboxContext';
import { useTerminologyWithIndustry } from '@/hooks/useTerminology';
import { toast } from '@/hooks/use-toast';

export default function DemoEquipment() {
  const { getDemoEquipment, getDemoClients, getDemoJobs, industry } = useDemoSandbox();
  const { t } = useTerminologyWithIndustry(industry);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);

  const equipment = getDemoEquipment();
  const clients = getDemoClients();
  const jobs = getDemoJobs();

  const filteredEquipment = equipment.filter(eq => {
    const client = clients.find(c => c.id === eq.client_id);
    const matchesSearch = 
      eq.equipment_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.serial_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const normalizedStatus = eq.status === 'active' ? 'operational' : eq.status;
    const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter || eq.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedEquipmentData = equipment.find(e => e.id === selectedEquipment);
  const selectedEquipmentClient = selectedEquipmentData ? clients.find(c => c.id === selectedEquipmentData.client_id) : null;
  const equipmentJobs = selectedEquipment ? jobs.filter(j => j.equipment_id === selectedEquipment) : [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'needs_service': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'out_of_service': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (status) {
      case 'operational':
      case 'active':
        return 'default';
      case 'needs_service': return 'secondary';
      case 'out_of_service': return 'destructive';
      default: return 'secondary';
    }
  };

  const getWarrantyStatus = (warrantyExpiry: string | null): { label: string; variant: "default" | "destructive" | "outline" | "secondary" } | null => {
    if (!warrantyExpiry) return null;
    const expiry = new Date(warrantyExpiry);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return { label: 'Expired', variant: 'destructive' };
    if (daysUntilExpiry < 30) return { label: 'Expiring Soon', variant: 'secondary' };
    return { label: 'Active', variant: 'default' };
  };

  // Stats
  const totalEquipment = equipment.length;
  const operationalCount = equipment.filter(e => e.status === 'operational' || e.status === 'active').length;
  const needsServiceCount = equipment.filter(e => e.status === 'needs_service').length;

  return (
    <div className="space-y-4 md:space-y-6" data-tour="equipment-list">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">{t('equipment')}</h1>
          <p className="text-muted-foreground">Track {t('client').toLowerCase()} {t('equipment').toLowerCase()} and warranties</p>
        </div>
        <Button onClick={() => toast({
          title: "Demo Mode",
          description: `In the full app, you would add new ${t('equipment').toLowerCase()} here. Sign up to try it!`,
        })}>
          <Wrench className="h-4 w-4 mr-2" />
          Add {t('equipmentSingular')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 md:gap-4 grid-cols-3">
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total {t('equipment')}</p>
                <p className="text-2xl font-bold">{totalEquipment}</p>
              </div>
              <Wrench className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Operational</p>
                <p className="text-2xl font-bold text-green-600">{operationalCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Needs Service</p>
                <p className="text-2xl font-bold text-yellow-600">{needsServiceCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 md:pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${t('equipment').toLowerCase()}, brand, model, or serial...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="operational">Operational</SelectItem>
                <SelectItem value="needs_service">Needs Service</SelectItem>
                <SelectItem value="out_of_service">Out of Service</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Equipment Grid */}
      <div className="grid gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredEquipment.map(eq => {
          const client = clients.find(c => c.id === eq.client_id);
          const warranty = getWarrantyStatus(eq.warranty_expiry);
          
          return (
            <Card
              key={eq.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedEquipment(eq.id)}
            >
              <CardContent className="pt-4 md:pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(eq.status)}
                    <Badge variant={getStatusColor(eq.status) as any} className="capitalize">
                      {eq.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  {warranty && (
                    <Badge variant={warranty.variant} className="text-xs">
                      Warranty: {warranty.label}
                    </Badge>
                  )}
                </div>

                <h3 className="font-semibold mb-1">{eq.equipment_type}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {eq.brand} {eq.model}
                </p>

                {eq.serial_number && (
                  <p className="text-xs text-muted-foreground mb-3">
                    S/N: {eq.serial_number}
                  </p>
                )}

                <div className="pt-3 border-t">
                  <p className="text-sm font-medium">{client?.name}</p>
                  {eq.location_notes && (
                    <p className="text-xs text-muted-foreground">{eq.location_notes}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Equipment Detail Sheet */}
      <Sheet open={!!selectedEquipment} onOpenChange={() => setSelectedEquipment(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedEquipmentData && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedEquipmentData.equipment_type}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="flex gap-2">
                  <Badge variant={getStatusColor(selectedEquipmentData.status) as any} className="capitalize">
                    {selectedEquipmentData.status.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Brand</h4>
                      <p>{selectedEquipmentData.brand || '-'}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Model</h4>
                      <p>{selectedEquipmentData.model || '-'}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Serial Number</h4>
                    <p>{selectedEquipmentData.serial_number || '-'}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">{t('client')}</h4>
                    <p className="font-medium">{selectedEquipmentClient?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedEquipmentClient?.address}</p>
                  </div>

                  {selectedEquipmentData.location_notes && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Location</h4>
                      <p>{selectedEquipmentData.location_notes}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Install Date</h4>
                      <p>
                        {selectedEquipmentData.install_date
                          ? format(new Date(selectedEquipmentData.install_date), 'MMM d, yyyy')
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Warranty Expires</h4>
                      <p>
                        {selectedEquipmentData.warranty_expiry
                          ? format(new Date(selectedEquipmentData.warranty_expiry), 'MMM d, yyyy')
                          : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Service History */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Service History</h4>
                  {equipmentJobs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No service history</p>
                  ) : (
                    <div className="space-y-2">
                      {equipmentJobs.map(job => (
                        <Card key={job.id}>
                          <CardContent className="py-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{job.title}</p>
                                <p className="text-sm text-muted-foreground">{job.scheduled_date}</p>
                              </div>
                              <Badge variant="outline" className="capitalize">
                                {job.status.replace('_', ' ')}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button className="flex-1" onClick={() => toast({
                    title: "Demo Mode",
                    description: `In the full app, you can schedule a service ${t('job').toLowerCase()} for this ${t('equipmentSingular').toLowerCase()}. Sign up to try it!`,
                  })}>Schedule Service</Button>
                  <Button variant="outline" className="flex-1" onClick={() => toast({
                    title: "Demo Mode",
                    description: `In the full app, you can edit ${t('equipmentSingular').toLowerCase()} details and warranty info. Sign up to try it!`,
                  })}>Edit {t('equipmentSingular')}</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
