import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Slider } from '@/components/ui/slider';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Flag, Search, Users, Percent, Power, Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  rollout_percentage: number;
  allowed_tenant_ids: string[] | null;
  blocked_tenant_ids: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface FlagFormData {
  key: string;
  name: string;
  description: string;
  is_enabled: boolean;
  rollout_percentage: number;
  allowed_tenant_ids: string[];
  blocked_tenant_ids: string[];
  starts_at: string;
  ends_at: string;
}

const initialFormData: FlagFormData = {
  key: '',
  name: '',
  description: '',
  is_enabled: false,
  rollout_percentage: 0,
  allowed_tenant_ids: [],
  blocked_tenant_ids: [],
  starts_at: '',
  ends_at: '',
};

export default function AdminFeatureFlags() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [formData, setFormData] = useState<FlagFormData>(initialFormData);

  // Fetch feature flags
  const { data: flags = [], isLoading: flagsLoading } = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FeatureFlag[];
    },
  });

  // Fetch tenants for allowlist/blocklist selection
  const { data: tenants = [] } = useQuery({
    queryKey: ['admin-tenants-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug')
        .order('name');
      if (error) throw error;
      return data as Tenant[];
    },
  });

  // Create flag mutation
  const createMutation = useMutation({
    mutationFn: async (data: FlagFormData) => {
      const { error } = await supabase.from('feature_flags').insert({
        key: data.key,
        name: data.name,
        description: data.description || null,
        is_enabled: data.is_enabled,
        rollout_percentage: data.rollout_percentage,
        allowed_tenant_ids: data.allowed_tenant_ids.length > 0 ? data.allowed_tenant_ids : null,
        blocked_tenant_ids: data.blocked_tenant_ids.length > 0 ? data.blocked_tenant_ids : null,
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      toast({ title: 'Feature flag created' });
      setIsCreateOpen(false);
      setFormData(initialFormData);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create flag', description: error.message, variant: 'destructive' });
    },
  });

  // Update flag mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FlagFormData> }) => {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.is_enabled !== undefined) updateData.is_enabled = data.is_enabled;
      if (data.rollout_percentage !== undefined) updateData.rollout_percentage = data.rollout_percentage;
      if (data.allowed_tenant_ids !== undefined) {
        updateData.allowed_tenant_ids = data.allowed_tenant_ids.length > 0 ? data.allowed_tenant_ids : null;
      }
      if (data.blocked_tenant_ids !== undefined) {
        updateData.blocked_tenant_ids = data.blocked_tenant_ids.length > 0 ? data.blocked_tenant_ids : null;
      }
      if (data.starts_at !== undefined) updateData.starts_at = data.starts_at || null;
      if (data.ends_at !== undefined) updateData.ends_at = data.ends_at || null;

      const { error } = await supabase
        .from('feature_flags')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      toast({ title: 'Feature flag updated' });
      setEditingFlag(null);
      setFormData(initialFormData);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update flag', description: error.message, variant: 'destructive' });
    },
  });

  // Delete flag mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feature_flags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      toast({ title: 'Feature flag deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete flag', description: error.message, variant: 'destructive' });
    },
  });

  // Quick toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('feature_flags')
        .update({ is_enabled })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to toggle flag', description: error.message, variant: 'destructive' });
    },
  });

  const filteredFlags = flags.filter(flag =>
    flag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    flag.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openEditDialog = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    setFormData({
      key: flag.key,
      name: flag.name,
      description: flag.description || '',
      is_enabled: flag.is_enabled,
      rollout_percentage: flag.rollout_percentage,
      allowed_tenant_ids: flag.allowed_tenant_ids || [],
      blocked_tenant_ids: flag.blocked_tenant_ids || [],
      starts_at: flag.starts_at ? flag.starts_at.slice(0, 16) : '',
      ends_at: flag.ends_at ? flag.ends_at.slice(0, 16) : '',
    });
  };

  const handleSubmit = () => {
    if (editingFlag) {
      updateMutation.mutate({ id: editingFlag.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getTenantName = (id: string) => {
    const tenant = tenants.find(t => t.id === id);
    return tenant?.name || id.slice(0, 8);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="h-6 w-6" />
            Feature Flags
          </h1>
          <p className="text-muted-foreground">
            Control feature rollouts across the platform
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setFormData(initialFormData)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Flag
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Feature Flag</DialogTitle>
              <DialogDescription>
                Add a new feature flag for controlled rollouts
              </DialogDescription>
            </DialogHeader>
            <FlagForm
              formData={formData}
              setFormData={setFormData}
              tenants={tenants}
              isNew
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={createMutation.isPending || !formData.key || !formData.name}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Flag
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search flags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{flags.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Enabled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {flags.filter(f => f.is_enabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Full Rollout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {flags.filter(f => f.is_enabled && f.rollout_percentage === 100).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Partial Rollout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {flags.filter(f => f.is_enabled && f.rollout_percentage > 0 && f.rollout_percentage < 100).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flags Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Flags</CardTitle>
          <CardDescription>
            {filteredFlags.length} flag{filteredFlags.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {flagsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFlags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No flags match your search' : 'No feature flags yet'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rollout</TableHead>
                  <TableHead>Targeting</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFlags.map((flag) => (
                  <TableRow key={flag.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{flag.name}</div>
                        <div className="text-sm text-muted-foreground font-mono">{flag.key}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={flag.is_enabled}
                          onCheckedChange={(checked) => 
                            toggleMutation.mutate({ id: flag.id, is_enabled: checked })
                          }
                          disabled={toggleMutation.isPending}
                        />
                        <Badge variant={flag.is_enabled ? 'default' : 'secondary'}>
                          {flag.is_enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{flag.rollout_percentage}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {flag.allowed_tenant_ids?.length ? (
                          <Badge variant="outline" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {flag.allowed_tenant_ids.length} allowed
                          </Badge>
                        ) : null}
                        {flag.blocked_tenant_ids?.length ? (
                          <Badge variant="outline" className="text-xs text-destructive">
                            {flag.blocked_tenant_ids.length} blocked
                          </Badge>
                        ) : null}
                        {flag.starts_at || flag.ends_at ? (
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            Scheduled
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(flag.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(flag)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Feature Flag</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{flag.name}"? This action cannot be undone and may affect live features.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(flag.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingFlag} onOpenChange={(open) => !open && setEditingFlag(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Feature Flag</DialogTitle>
            <DialogDescription>
              Update "{editingFlag?.name}" configuration
            </DialogDescription>
          </DialogHeader>
          <FlagForm
            formData={formData}
            setFormData={setFormData}
            tenants={tenants}
            isNew={false}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFlag(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={updateMutation.isPending || !formData.name}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Form component for create/edit
function FlagForm({
  formData,
  setFormData,
  tenants,
  isNew,
}: {
  formData: FlagFormData;
  setFormData: React.Dispatch<React.SetStateAction<FlagFormData>>;
  tenants: Tenant[];
  isNew: boolean;
}) {
  const toggleTenantInList = (
    list: 'allowed_tenant_ids' | 'blocked_tenant_ids',
    tenantId: string
  ) => {
    setFormData((prev) => {
      const current = prev[list];
      if (current.includes(tenantId)) {
        return { ...prev, [list]: current.filter((id) => id !== tenantId) };
      }
      return { ...prev, [list]: [...current, tenantId] };
    });
  };

  return (
    <div className="space-y-6 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="key">Key *</Label>
          <Input
            id="key"
            placeholder="new_calendar_ui"
            value={formData.key}
            onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
            disabled={!isNew}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Used in code to check flag status
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            placeholder="New Calendar UI"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="What this flag controls..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
        />
      </div>

      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <Power className={formData.is_enabled ? 'text-green-600' : 'text-muted-foreground'} />
          <div>
            <Label>Enabled (Kill Switch)</Label>
            <p className="text-sm text-muted-foreground">
              Master toggle - when off, flag is disabled for everyone
            </p>
          </div>
        </div>
        <Switch
          checked={formData.is_enabled}
          onCheckedChange={(checked) => setFormData({ ...formData, is_enabled: checked })}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Rollout Percentage</Label>
          <span className="text-lg font-bold">{formData.rollout_percentage}%</span>
        </div>
        <Slider
          value={[formData.rollout_percentage]}
          onValueChange={([value]) => setFormData({ ...formData, rollout_percentage: value })}
          max={100}
          step={5}
        />
        <p className="text-xs text-muted-foreground">
          Percentage of tenants (not in allow/block lists) that will see this feature
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="starts_at">Starts At (Optional)</Label>
          <Input
            id="starts_at"
            type="datetime-local"
            value={formData.starts_at}
            onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ends_at">Ends At (Optional)</Label>
          <Input
            id="ends_at"
            type="datetime-local"
            value={formData.ends_at}
            onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Allowed Tenants (Always enabled)</Label>
        <div className="border rounded-lg max-h-32 overflow-y-auto p-2">
          {tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">No tenants available</p>
          ) : (
            <div className="space-y-1">
              {tenants.map((tenant) => (
                <label
                  key={tenant.id}
                  className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.allowed_tenant_ids.includes(tenant.id)}
                    onChange={() => toggleTenantInList('allowed_tenant_ids', tenant.id)}
                    className="rounded"
                  />
                  <span className="text-sm">{tenant.name}</span>
                  <span className="text-xs text-muted-foreground">({tenant.slug})</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Blocked Tenants (Always disabled)</Label>
        <div className="border rounded-lg max-h-32 overflow-y-auto p-2">
          {tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">No tenants available</p>
          ) : (
            <div className="space-y-1">
              {tenants.map((tenant) => (
                <label
                  key={tenant.id}
                  className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.blocked_tenant_ids.includes(tenant.id)}
                    onChange={() => toggleTenantInList('blocked_tenant_ids', tenant.id)}
                    className="rounded"
                  />
                  <span className="text-sm">{tenant.name}</span>
                  <span className="text-xs text-muted-foreground">({tenant.slug})</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
