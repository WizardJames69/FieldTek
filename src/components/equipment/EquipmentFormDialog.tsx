import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTerminology } from "@/hooks/useTerminology";

const equipmentFormSchema = z.object({
  equipment_type: z.string().min(1, "Equipment type is required"),
  brand: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  client_id: z.string().optional(),
  install_date: z.date().optional(),
  warranty_expiry: z.date().optional(),
  status: z.string().default("active"),
  location_notes: z.string().optional(),
});

type EquipmentFormValues = z.infer<typeof equipmentFormSchema>;

interface Client {
  id: string;
  name: string;
}

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
}

interface EquipmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: Equipment | null;
  onSuccess: () => void;
  preselectedClientId?: string;
}

export function EquipmentFormDialog({
  open,
  onOpenChange,
  equipment,
  onSuccess,
  preselectedClientId,
}: EquipmentFormDialogProps) {
  const { tenant, settings } = useTenant();
  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [installDateCalendarOpen, setInstallDateCalendarOpen] = useState(false);
  const [warrantyExpiryCalendarOpen, setWarrantyExpiryCalendarOpen] = useState(false);
  const { t } = useTerminology();
  const equipmentTypes = (settings?.equipment_types as string[]) || [
    "HVAC Unit",
    "Furnace",
    "Air Conditioner",
    "Heat Pump",
    "Boiler",
    "Water Heater",
    "Thermostat",
    "Other",
  ];

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      equipment_type: "",
      brand: "",
      model: "",
      serial_number: "",
      client_id: preselectedClientId || "",
      status: "active",
      location_notes: "",
    },
  });

  useEffect(() => {
    if (equipment) {
      form.reset({
        equipment_type: equipment.equipment_type,
        brand: equipment.brand || "",
        model: equipment.model || "",
        serial_number: equipment.serial_number || "",
        client_id: equipment.client_id || "",
        install_date: equipment.install_date ? new Date(equipment.install_date) : undefined,
        warranty_expiry: equipment.warranty_expiry ? new Date(equipment.warranty_expiry) : undefined,
        status: equipment.status || "active",
        location_notes: equipment.location_notes || "",
      });
    } else {
      form.reset({
        equipment_type: "",
        brand: "",
        model: "",
        serial_number: "",
        client_id: preselectedClientId || "",
        status: "active",
        location_notes: "",
      });
    }
  }, [equipment, preselectedClientId, form]);

  useEffect(() => {
    const fetchClients = async () => {
      if (!tenant?.id || !open) return;

      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("tenant_id", tenant.id)
        .order("name");

      setClients(data || []);
    };

    fetchClients();
  }, [tenant?.id, open]);

  const onSubmit = async (values: EquipmentFormValues) => {
    if (!tenant?.id) return;

    setIsLoading(true);
    try {
      const equipmentData = {
        tenant_id: tenant.id,
        equipment_type: values.equipment_type,
        brand: values.brand || null,
        model: values.model || null,
        serial_number: values.serial_number || null,
        client_id: values.client_id || null,
        install_date: values.install_date ? format(values.install_date, "yyyy-MM-dd") : null,
        warranty_expiry: values.warranty_expiry ? format(values.warranty_expiry, "yyyy-MM-dd") : null,
        status: values.status,
        location_notes: values.location_notes || null,
      };

      if (equipment) {
        const { error } = await supabase
          .from("equipment_registry")
          .update(equipmentData)
          .eq("id", equipment.id);

        if (error) throw error;
        toast.success("Equipment updated successfully");
      } else {
        const { error } = await supabase
          .from("equipment_registry")
          .insert(equipmentData);

        if (error) throw error;
        toast.success("Equipment added successfully");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving equipment:", error);
      toast.error("Failed to save equipment");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="equipment-form-dialog">
        <DialogHeader>
          <DialogTitle>{equipment ? `Edit ${t('equipmentSingular')}` : `Add ${t('equipmentSingular')}`}</DialogTitle>
          <DialogDescription>
            {equipment ? `Update ${t('equipmentSingular').toLowerCase()} information` : `Add new ${t('equipmentSingular').toLowerCase()} to your registry`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="equipment_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('equipmentSingular')} Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="equipment-form-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {equipmentTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('client')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${t('client').toLowerCase()}`} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Carrier, Trane" {...field} data-testid="equipment-form-brand" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="Model number" {...field} data-testid="equipment-form-model" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serial_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Serial number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="maintenance">Under Maintenance</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="install_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Install Date</FormLabel>
                    <Popover open={installDateCalendarOpen} onOpenChange={setInstallDateCalendarOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : "Select date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date);
                            setInstallDateCalendarOpen(false);
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="warranty_expiry"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Warranty Expiry</FormLabel>
                    <Popover open={warrantyExpiryCalendarOpen} onOpenChange={setWarrantyExpiryCalendarOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : "Select date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date);
                            setWarrantyExpiryCalendarOpen(false);
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Where is this equipment located? (e.g., basement, rooftop, unit 3A)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} data-testid="equipment-form-save">
                {isLoading ? "Saving..." : equipment ? "Update" : `Add ${t('equipmentSingular')}`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
