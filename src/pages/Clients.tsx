import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { 
  Plus, 
  MoreHorizontal, 
  Search, 
  Mail, 
  Phone, 
  MapPin,
  Pencil,
  Trash2,
  Eye,
  Users,
  Download,
  Upload,
  Send
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ClientFormDialog } from '@/components/clients/ClientFormDialog';
import { ClientDetailSheet } from '@/components/clients/ClientDetailSheet';
import { CSVImportDialog } from '@/components/import';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant, useUserRole } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Client } from '@/types/database';
import { useNavigate } from 'react-router-dom';
import { useTerminology } from '@/hooks/useTerminology';
import { useSelection } from '@/hooks/useSelection';
import { SelectCheckbox, SelectAllCheckbox } from '@/components/bulk/SelectCheckbox';
import { BulkActionToolbar } from '@/components/bulk/BulkActionToolbar';
import { BulkConfirmDialog } from '@/components/bulk/BulkConfirmDialog';
import { exportClientsToCsv } from '@/lib/exportCsv';

interface ClientWithStats extends Client {
  job_count?: number;
  equipment_count?: number;
}

export default function Clients() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const { t } = useTerminology();

  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [sendingInviteClientId, setSendingInviteClientId] = useState<string | null>(null);
  // Bulk selection
  const selection = useSelection();
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && !tenantLoading && user && !tenant) {
      navigate('/onboarding');
    }
  }, [user, tenant, authLoading, tenantLoading, navigate]);

  useEffect(() => {
    if (tenant) {
      fetchClients();
    }
  }, [tenant]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (clientsError) throw clientsError;

      // Fetch job counts per client
      const { data: jobCounts } = await supabase
        .from('scheduled_jobs')
        .select('client_id');

      // Fetch equipment counts per client  
      const { data: equipmentCounts } = await supabase
        .from('equipment_registry')
        .select('client_id');

      // Build counts map
      const jobCountMap: Record<string, number> = {};
      const equipmentCountMap: Record<string, number> = {};

      (jobCounts || []).forEach(j => {
        if (j.client_id) {
          jobCountMap[j.client_id] = (jobCountMap[j.client_id] || 0) + 1;
        }
      });

      (equipmentCounts || []).forEach(e => {
        if (e.client_id) {
          equipmentCountMap[e.client_id] = (equipmentCountMap[e.client_id] || 0) + 1;
        }
      });

      // Combine data
      const clientsWithStats: ClientWithStats[] = (clientsData || []).map(client => ({
        ...client,
        job_count: jobCountMap[client.id] || 0,
        equipment_count: equipmentCountMap[client.id] || 0,
      }));

      setClients(clientsWithStats);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading clients',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!deleteClientId) return;
    
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', deleteClientId);

      if (error) throw error;
      
      toast({ title: 'Client deleted successfully' });
      setClients(clients.filter(c => c.id !== deleteClientId));
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error deleting client',
        description: error.message,
      });
    } finally {
      setDeleteClientId(null);
    }
  };

  const handleViewClient = (client: Client) => {
    setSelectedClient(client);
    setIsDetailOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setIsFormOpen(true);
    setIsDetailOpen(false);
  };

  const handleResendPortalInvitation = async (client: Client) => {
    if (!tenant || !client.email) return;
    setSendingInviteClientId(client.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-portal-invitation', {
        body: { clientId: client.id, tenantId: tenant.id },
      });
      if (error) throw error;
      toast({ title: 'Portal invitation sent', description: `Invitation email sent to ${client.email}` });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to send invitation',
        description: error.message,
      });
    } finally {
      setSendingInviteClientId(null);
    }
  };

  // Bulk operations
  const handleBulkDelete = async () => {
    setBulkDeleteLoading(true);
    try {
      const ids = selection.selectedArray;
      const { error } = await supabase
        .from('clients')
        .delete()
        .in('id', ids);

      if (error) throw error;

      setClients(clients.filter(c => !ids.includes(c.id)));
      toast({ title: `${ids.length} clients deleted` });
      selection.clearAll();
      setBulkDeleteOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error deleting clients',
        description: error.message,
      });
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleExportSelected = () => {
    const selectedClients = clients.filter(c => selection.selectedIds.has(c.id));
    exportClientsToCsv(selectedClients);
    toast({ title: `Exported ${selectedClients.length} clients to CSV` });
  };

  // Filter clients
  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    
    const query = searchQuery.toLowerCase();
    return clients.filter((client) => 
      client.name.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.phone?.toLowerCase().includes(query) ||
      client.address?.toLowerCase().includes(query) ||
      client.city?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  const filteredClientIds = useMemo(() => filteredClients.map(c => c.id), [filteredClients]);

  if (authLoading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <MainLayout 
      title={t('clients')} 
      subtitle={`${filteredClients.length} ${t('clients').toLowerCase()}`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import CSV</span>
          </Button>
          <Button onClick={() => { setSelectedClient(null); setIsFormOpen(true); }} className="gap-2 btn-shimmer touch-native" data-testid="clients-create-button">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add {t('client')}</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4 md:space-y-6 animate-fade-up">
        {/* Phase 6: Glass search filter container */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {filteredClients.length > 0 && (
                <SelectAllCheckbox
                  checked={selection.isAllSelected(filteredClientIds)}
                  indeterminate={selection.isPartiallySelected(filteredClientIds)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      selection.selectAll(filteredClientIds);
                    } else {
                      selection.clearAll();
                    }
                  }}
                  className="flex-shrink-0"
                />
              )}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients by name, email, phone, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                  data-testid="clients-search-input"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clients Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-12 w-12 bg-muted rounded-full" />
                    <div className="flex-1">
                      <div className="h-5 bg-muted rounded w-2/3 mb-2" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <Card className="border-dashed app-glass-container" data-testid="clients-empty-state">
            <CardContent className="p-12 text-center">
              {/* Phase 5: Enhanced empty state with radial glow */}
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-xl" />
                <div className="relative w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center empty-state-glow">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
              <h3 className="font-semibold text-lg mb-2">No {t('clients').toLowerCase()} found</h3>
              <p className="text-muted-foreground mb-4">
                {clients.length === 0 
                  ? `You haven't added any ${t('clients').toLowerCase()} yet.` 
                  : `No ${t('clients').toLowerCase()} match your search.`}
              </p>
              <Button onClick={() => { setSelectedClient(null); setIsFormOpen(true); }} className="touch-native">
                <Plus className="h-4 w-4 mr-2" />
                Add your first {t('client').toLowerCase()}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4" data-testid="clients-list">
            {filteredClients.map((client) => {
              // Phase 6: Equipment/job count indicator glow
              const hasActivity = (client.job_count || 0) > 0 || (client.equipment_count || 0) > 0;
              
              return (
              <Card
                key={client.id}
                className={cn(
                  "card-interactive card-premium group cursor-pointer touch-native relative overflow-hidden",
                  hasActivity && "border-primary/10",
                  selection.isSelected(client.id) && "ring-2 ring-primary/50"
                )}
                onClick={() => handleViewClient(client)}
                data-testid="client-card"
              >
                {/* Subtle activity indicator */}
                {hasActivity && (
                  <div className="absolute top-0 right-0 w-16 h-16 opacity-50 pointer-events-none">
                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-primary/10 to-transparent" />
                  </div>
                )}
                <CardContent className="p-5 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <SelectCheckbox
                          checked={selection.isSelected(client.id)}
                          onCheckedChange={() => selection.toggle(client.id)}
                          aria-label={`Select ${client.name}`}
                          className="absolute -left-1 -top-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                        <Avatar className="h-11 w-11 ring-2 ring-primary/20 ring-offset-1 ring-offset-background">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                            {client.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{client.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {client.job_count || 0} {t('jobs').toLowerCase()} • {client.equipment_count || 0} {t('equipment').toLowerCase()}
                        </p>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewClient(client); }}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditClient(client); }}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {client.email && (
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); handleResendPortalInvitation(client); }}
                            disabled={sendingInviteClientId === client.id}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {sendingInviteClientId === client.id ? 'Sending...' : 'Resend Portal Invitation'}
                          </DropdownMenuItem>
                        )}
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); setDeleteClientId(client.id); }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    {client.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    {(client.city || client.state) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{[client.city, client.state].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                    {!client.email && !client.phone && !client.city && (
                      <p className="text-muted-foreground/60 italic">No contact info</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selection.count}
        onClearSelection={selection.clearAll}
      >
        <Button size="sm" variant="outline" onClick={handleExportSelected}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>

        {isAdmin && (
          <Button 
            size="sm" 
            variant="outline" 
            className="text-destructive hover:text-destructive"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
      </BulkActionToolbar>

      <BulkConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete Selected Clients"
        description={`Are you sure you want to delete ${selection.count} clients? This will not delete their associated jobs or equipment records.`}
        actionLabel="Delete Clients"
        onConfirm={handleBulkDelete}
        isLoading={bulkDeleteLoading}
        variant="destructive"
      />

      {/* Create/Edit Dialog */}
      <ClientFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        client={selectedClient}
        onSuccess={fetchClients}
      />

      {/* Detail Sheet */}
      <ClientDetailSheet
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        client={selectedClient}
        onEdit={() => handleEditClient(selectedClient!)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteClientId} onOpenChange={() => setDeleteClientId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this client? This will not delete their associated jobs or equipment records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Import Dialog */}
      <CSVImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={fetchClients}
      />
    </MainLayout>
  );
}
