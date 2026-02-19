import { useState } from 'react';
import {
  Users,
  Search,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  DollarSign,
  Upload,
  Wrench,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDemoSandbox } from '@/contexts/DemoSandboxContext';
import { useTerminologyWithIndustry } from '@/hooks/useTerminology';
import { toast } from '@/hooks/use-toast';

export default function DemoClients() {
  const { getDemoClients, getDemoJobs, getDemoInvoices, getDemoEquipment, industry } = useDemoSandbox();
  const { t } = useTerminologyWithIndustry(industry);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const clients = getDemoClients();
  const jobs = getDemoJobs();
  const invoices = getDemoInvoices();
  const equipment = getDemoEquipment();

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.phone?.includes(searchQuery)
  );

  const selectedClientData = clients.find(c => c.id === selectedClient);
  const clientJobs = selectedClient ? jobs.filter(j => j.client_id === selectedClient) : [];
  const clientInvoices = selectedClient ? invoices.filter(i => i.client_id === selectedClient) : [];
  const clientEquipment = selectedClient ? equipment.filter(e => e.client_id === selectedClient) : [];

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getClientStats = (clientId: string) => {
    const clientJobs = jobs.filter(j => j.client_id === clientId);
    const clientInvoices = invoices.filter(i => i.client_id === clientId);
    const totalSpent = clientInvoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + (i.total || 0), 0);
    
    return {
      jobCount: clientJobs.length,
      totalSpent,
    };
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">{t('clients')}</h1>
          <p className="text-muted-foreground">Manage your {t('client').toLowerCase()} relationships</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => setShowImportDialog(true)}
            data-tour="import-button"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => toast({
            title: "Demo Mode",
            description: `In the full app, you would add a new ${t('client').toLowerCase()} here. Sign up to try it!`,
          })}>
            <Users className="h-4 w-4 mr-2" />
            Add {t('client')}
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4 md:pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${t('clients').toLowerCase()} by name, email, or phone...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients Grid */}
      <div className="grid gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-3" data-tour="clients-list">
        {filteredClients.map(client => {
          const stats = getClientStats(client.id);
          return (
            <Card
              key={client.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedClient(client.id)}
            >
              <CardContent className="pt-4 md:pt-6">
                <div className="flex items-start gap-3 md:gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(client.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{client.name}</h3>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {client.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-4 mt-3 pt-3 border-t text-sm">
                      <div className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3 text-muted-foreground" />
                        <span>{stats.jobCount} {stats.jobCount === 1 ? t('job').toLowerCase() : t('jobs').toLowerCase()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span>${stats.totalSpent.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Client Detail Sheet */}
      <Sheet open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedClientData && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {getInitials(selectedClientData.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle>{selectedClientData.name}</SheetTitle>
                    <p className="text-sm text-muted-foreground">{t('client')}</p>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Contact Info */}
                <div className="space-y-3">
                  {selectedClientData.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedClientData.phone}</span>
                    </div>
                  )}
                  {selectedClientData.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedClientData.email}</span>
                    </div>
                  )}
                  {selectedClientData.address && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {selectedClientData.address}
                        {selectedClientData.city && `, ${selectedClientData.city}`}
                        {selectedClientData.state && `, ${selectedClientData.state}`}
                        {selectedClientData.zip_code && ` ${selectedClientData.zip_code}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <Tabs defaultValue="jobs" className="w-full">
                  <TabsList className="w-full">
                    <TabsTrigger value="jobs" className="flex-1">{t('jobs')} ({clientJobs.length})</TabsTrigger>
                    <TabsTrigger value="invoices" className="flex-1">Invoices ({clientInvoices.length})</TabsTrigger>
                    <TabsTrigger value="equipment" className="flex-1">{t('equipment')} ({clientEquipment.length})</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="jobs" className="mt-4 space-y-2">
                    {clientJobs.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">No {t('jobs').toLowerCase()} yet</p>
                    ) : (
                      clientJobs.map(job => (
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
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="invoices" className="mt-4 space-y-2">
                    {clientInvoices.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">No invoices yet</p>
                    ) : (
                      clientInvoices.map(invoice => (
                        <Card key={invoice.id}>
                          <CardContent className="py-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{invoice.invoice_number}</p>
                                <p className="text-sm text-muted-foreground">
                                  ${(invoice.total || 0).toLocaleString()}
                                </p>
                              </div>
                              <Badge variant="outline" className="capitalize">
                                {invoice.status}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="equipment" className="mt-4 space-y-2" data-tour="client-equipment">
                    <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                      <Wrench className="h-4 w-4" />
                      <span>{t('equipment')} History & Warranties</span>
                    </div>
                    {clientEquipment.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">No {t('equipment').toLowerCase()} registered</p>
                    ) : (
                      clientEquipment.map(eq => (
                        <Card key={eq.id}>
                          <CardContent className="py-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{eq.equipment_type}</p>
                                <p className="text-sm text-muted-foreground">
                                  {eq.brand} {eq.model}
                                </p>
                                {eq.serial_number && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    S/N: {eq.serial_number}
                                  </p>
                                )}
                                {eq.warranty_expiry && (
                                  <p className="text-xs text-muted-foreground">
                                    Warranty: {eq.warranty_expiry}
                                  </p>
                                )}
                              </div>
                              <Badge variant="outline" className="capitalize">
                                {eq.status}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>
                </Tabs>

                <div className="flex gap-2 pt-4">
                  <Button className="flex-1" onClick={() => toast({
                    title: "Demo Mode",
                    description: `In the full app, you can create a ${t('job').toLowerCase()} directly from the ${t('client').toLowerCase()} profile. Sign up to try it!`,
                  })}>Create {t('job')}</Button>
                  <Button variant="outline" className="flex-1" onClick={() => toast({
                    title: "Demo Mode",
                    description: `In the full app, you can edit ${t('client').toLowerCase()} details and contact info. Sign up to try it!`,
                  })}>Edit {t('client')}</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* CSV Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import {t('clients')} from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk import {t('clients').toLowerCase()}. We'll help you map your columns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop your CSV file here, or click to browse
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => toast({
                  title: "Demo Mode",
                  description: "In the full app, you can import clients, equipment, and jobs from CSV files. Sign up to try it!",
                })}
              >
                Select File
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Supported columns:</p>
              <p>Name, Email, Phone, Address, City, State, Zip Code, Notes</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
