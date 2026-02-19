import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Wrench,
  Calendar,
  User,
  MapPin,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  Edit,
} from "lucide-react";
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

interface ServiceHistory {
  id: string;
  title: string;
  job_type: string | null;
  status: string | null;
  scheduled_date: string | null;
  description: string | null;
}

interface EquipmentDetailSheetProps {
  equipment: Equipment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (equipment: Equipment) => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  inactive: { label: "Inactive", variant: "secondary" },
  maintenance: { label: "Under Maintenance", variant: "outline" },
  retired: { label: "Retired", variant: "destructive" },
};

export function EquipmentDetailSheet({
  equipment,
  open,
  onOpenChange,
  onEdit,
}: EquipmentDetailSheetProps) {
  const [serviceHistory, setServiceHistory] = useState<ServiceHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { t } = useTerminology();
  useEffect(() => {
    const fetchServiceHistory = async () => {
      if (!equipment?.id || !open) return;

      setLoadingHistory(true);
      try {
        const { data } = await supabase
          .from("scheduled_jobs")
          .select("id, title, job_type, status, scheduled_date, description")
          .eq("equipment_id", equipment.id)
          .order("scheduled_date", { ascending: false })
          .limit(10);

        setServiceHistory(data || []);
      } catch (error) {
        console.error("Error fetching service history:", error);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchServiceHistory();
  }, [equipment?.id, open]);

  if (!equipment) return null;

  const isWarrantyExpired = equipment.warranty_expiry
    ? new Date(equipment.warranty_expiry) < new Date()
    : false;

  const isWarrantyExpiringSoon = equipment.warranty_expiry
    ? !isWarrantyExpired &&
      new Date(equipment.warranty_expiry) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    : false;

  const status = statusConfig[equipment.status || "active"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{equipment.equipment_type}</SheetTitle>
              <SheetDescription>
                {equipment.brand} {equipment.model}
              </SheetDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEdit(equipment)}>
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] pr-4">
          <div className="space-y-6 py-4">
            {/* Status and Quick Info */}
            <div className="flex flex-wrap gap-2">
              <Badge variant={status.variant}>{status.label}</Badge>
              {equipment.serial_number && (
                <Badge variant="outline">S/N: {equipment.serial_number}</Badge>
              )}
            </div>

            {/* Warranty Alert */}
            {equipment.warranty_expiry && (
              <Card
                className={cn(
                  "border-l-4",
                  isWarrantyExpired
                    ? "border-l-destructive bg-destructive/5"
                    : isWarrantyExpiringSoon
                    ? "border-l-orange-500 bg-orange-500/5"
                    : "border-l-green-500 bg-green-500/5"
                )}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  {isWarrantyExpired ? (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  ) : isWarrantyExpiringSoon ? (
                    <Clock className="h-5 w-5 text-orange-500" />
                  ) : (
                    <Shield className="h-5 w-5 text-green-500" />
                  )}
                  <div>
                    <p className="font-medium text-sm">
                      {isWarrantyExpired
                        ? "Warranty Expired"
                        : isWarrantyExpiringSoon
                        ? "Warranty Expiring Soon"
                        : "Under Warranty"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isWarrantyExpired ? "Expired on" : "Expires"}{" "}
                      {format(new Date(equipment.warranty_expiry), "PPP")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Equipment Details */}
            <div className="space-y-4">
              <h3 className="font-semibold">{t('equipmentSingular')} Details</h3>

              {equipment.clients && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">{t('client')}</p>
                    <p className="font-medium">{equipment.clients.name}</p>
                  </div>
                </div>
              )}

              {equipment.install_date && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Install Date</p>
                    <p className="font-medium">
                      {format(new Date(equipment.install_date), "PPP")}
                    </p>
                  </div>
                </div>
              )}

              {equipment.location_notes && (
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Location</p>
                    <p className="font-medium">{equipment.location_notes}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Added</p>
                  <p className="font-medium">
                    {format(new Date(equipment.created_at), "PPP")}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Service History */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Service History
              </h3>

              {loadingHistory ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : serviceHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No service history found</p>
              ) : (
                <div className="space-y-3">
                  {serviceHistory.map((job) => (
                    <Card key={job.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{job.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {job.job_type && <Badge variant="outline">{job.job_type}</Badge>}
                            {job.scheduled_date && (
                              <span>{format(new Date(job.scheduled_date), "MMM d, yyyy")}</span>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={job.status === "completed" ? "default" : "secondary"}
                          className="shrink-0"
                        >
                          {job.status === "completed" ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : null}
                          {job.status}
                        </Badge>
                      </div>
                      {job.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {job.description}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
