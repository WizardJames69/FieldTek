import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant, useUserRole } from "@/contexts/TenantContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { EquipmentFormDialog } from "@/components/equipment/EquipmentFormDialog";
import { EquipmentDetailSheet } from "@/components/equipment/EquipmentDetailSheet";
import { CSVImportDialog } from "@/components/import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  Loader2,
  Wrench,
  AlertTriangle,
  Shield,
  Clock,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTerminology } from "@/hooks/useTerminology";

interface Equipment {
  id: string;
  equipment_type: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  client_id: string | null;
  install_date: string | null;
  warranty_expiry: string | null;
  status: string | null;
  location_notes: string | null;
  created_at: string;
  clients?: { id: string; name: string } | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-green-500/20 text-green-700" },
  inactive: { label: "Inactive", color: "bg-muted text-muted-foreground" },
  maintenance: { label: "Maintenance", color: "bg-orange-500/20 text-orange-700" },
  retired: { label: "Retired", color: "bg-destructive/20 text-destructive" },
};

export default function Equipment() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading, settings } = useTenant();
  const { isAdmin } = useUserRole();
  const { t } = useTerminology();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const equipmentTypes = (settings?.equipment_types as string[]) || [];

  const fetchEquipment = useCallback(async () => {
    if (!tenant?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("equipment_registry")
        .select(`
          id,
          equipment_type,
          brand,
          model,
          serial_number,
          client_id,
          install_date,
          warranty_expiry,
          status,
          location_notes,
          created_at,
          clients (id, name)
        `)
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEquipment(data || []);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      toast.error("Failed to load equipment");
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (!tenantLoading && !tenant) {
      navigate("/onboarding");
      return;
    }
  }, [user, tenant, authLoading, tenantLoading, navigate]);

  useEffect(() => {
    if (tenant?.id) {
      fetchEquipment();
    }
  }, [tenant?.id, fetchEquipment]);

  const handleDelete = async () => {
    if (!equipmentToDelete) return;

    try {
      const { error } = await supabase
        .from("equipment_registry")
        .delete()
        .eq("id", equipmentToDelete.id);

      if (error) throw error;

      toast.success("Equipment deleted");
      setEquipment((prev) => prev.filter((e) => e.id !== equipmentToDelete.id));
    } catch (error) {
      console.error("Error deleting equipment:", error);
      toast.error("Failed to delete equipment");
    } finally {
      setDeleteDialogOpen(false);
      setEquipmentToDelete(null);
    }
  };

  const filteredEquipment = equipment.filter((item) => {
    const matchesSearch =
      searchQuery === "" ||
      item.equipment_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.serial_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.clients?.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesType = typeFilter === "all" || item.equipment_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const getWarrantyStatus = (warrantyExpiry: string | null) => {
    if (!warrantyExpiry) return null;

    const expiryDate = new Date(warrantyExpiry);
    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry < 0) {
      return { icon: AlertTriangle, color: "text-destructive", label: "Expired" };
    }
    if (daysUntilExpiry <= 90) {
      return { icon: Clock, color: "text-orange-500", label: `${daysUntilExpiry}d` };
    }
    return { icon: Shield, color: "text-green-500", label: "Valid" };
  };

  const uniqueTypes = [...new Set(equipment.map((e) => e.equipment_type))];

  if (authLoading || tenantLoading) {
    return (
      <MainLayout title="Equipment">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={t('equipment')}>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">{t('equipment')} Registry</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Track {t('equipment').toLowerCase()}, warranties, and service history
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsImportOpen(true)} size="sm">
              <Upload className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Import CSV</span>
            </Button>
            <Button onClick={() => { setSelectedEquipment(null); setDialogOpen(true); }} size="sm" data-testid="equipment-create-button">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Add {t('equipmentSingular')}</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* Filters - Phase 5: Glass filter card */}
        <Card className="backdrop-blur-sm bg-card/80">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search equipment, client, serial..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Equipment Table */}
        {loading ? (
          <div className="flex items-center justify-center h-[40vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredEquipment.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            {/* Phase 5: Enhanced empty state with radial glow */}
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-xl" />
              <div className="relative flex items-center justify-center empty-state-glow">
                <Wrench className="h-12 w-12 text-muted-foreground" />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2">No {t('equipment').toLowerCase()} found</h3>
            <p className="text-muted-foreground mb-4">
              {equipment.length === 0
                ? `Start by adding ${t('equipment').toLowerCase()} to your registry`
                : "Try adjusting your filters"}
            </p>
            {equipment.length === 0 && (
              <Button onClick={() => setDialogOpen(true)} className="touch-native">
                <Plus className="h-4 w-4 mr-2" />
                Add {t('equipmentSingular')}
              </Button>
            )}
          </Card>
        ) : (
          <Card data-testid="equipment-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Serial #</TableHead>
                  <TableHead>Warranty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEquipment.map((item) => {
                  const warranty = getWarrantyStatus(item.warranty_expiry);
                  const status = statusConfig[item.status || "active"];

                  return (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedEquipment(item);
                        setDetailOpen(true);
                      }}
                      data-testid="equipment-row"
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.equipment_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.brand} {item.model}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.clients?.name || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.serial_number || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {warranty ? (
                          <div className="flex items-center gap-1.5">
                            <warranty.icon className={cn("h-4 w-4", warranty.color)} />
                            <span className={cn("text-sm", warranty.color)}>
                              {warranty.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={status.color}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEquipmentToDelete(item);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <EquipmentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        equipment={selectedEquipment}
        onSuccess={() => {
          fetchEquipment();
          setSelectedEquipment(null);
        }}
      />

      <EquipmentDetailSheet
        equipment={selectedEquipment}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={(equip) => {
          setDetailOpen(false);
          setSelectedEquipment(equip);
          setDialogOpen(true);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Equipment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this equipment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Import Dialog */}
      <CSVImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={fetchEquipment}
      />
    </MainLayout>
  );
}
