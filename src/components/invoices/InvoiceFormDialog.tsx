import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays } from "date-fns";
import { CalendarIcon, Plus, Trash2, Wrench, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant, useTenantSettings } from "@/contexts/TenantContext";
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

const lineItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.number().min(1),
  unit_price: z.number().min(0),
  item_type: z.string().default("service"),
});

const invoiceFormSchema = z.object({
  client_id: z.string().min(1, "Client is required"),
  job_id: z.string().optional(),
  due_date: z.date(),
  notes: z.string().optional(),
  line_items: z.array(lineItemSchema).min(1, "At least one line item required"),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

interface Client {
  id: string;
  name: string;
}

interface Job {
  id: string;
  title: string;
  client_id: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string | null;
  job_id: string | null;
  due_date: string | null;
  notes: string | null;
  status: string | null;
}

interface JobPart {
  id: string;
  part_name: string;
  part_number: string | null;
  quantity: number;
  unit_cost: number;
  added_to_invoice: boolean;
}

interface InvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice | null;
  onSuccess: () => void;
  preselectedJobId?: string;
}

export function InvoiceFormDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess,
  preselectedJobId,
}: InvoiceFormDialogProps) {
  const { tenant } = useTenant();
  const settings = useTenantSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobParts, setJobParts] = useState<JobPart[]>([]);
  const [dueDateCalendarOpen, setDueDateCalendarOpen] = useState(false);

  const taxRate = (settings?.tax_rate as number) || 0;

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      client_id: "",
      job_id: preselectedJobId || "",
      due_date: addDays(new Date(), 30),
      notes: "",
      line_items: [{ description: "", quantity: 1, unit_price: 0, item_type: "service" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "line_items",
  });

  const watchedItems = form.watch("line_items");
  const subtotal = watchedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  useEffect(() => {
    if (!invoice) {
      form.reset({
        client_id: "",
        job_id: preselectedJobId || "",
        due_date: addDays(new Date(), 30),
        notes: "",
        line_items: [{ description: "", quantity: 1, unit_price: 0, item_type: "service" }],
      });
    }
  }, [invoice, preselectedJobId, form]);

  useEffect(() => {
    const fetchData = async () => {
      if (!tenant?.id || !open) return;

      const [clientsRes, jobsRes] = await Promise.all([
        supabase.from("clients").select("id, name").eq("tenant_id", tenant.id).order("name"),
        supabase.from("scheduled_jobs").select("id, title, client_id").eq("tenant_id", tenant.id).eq("status", "completed").order("scheduled_date", { ascending: false }),
      ]);

      setClients(clientsRes.data || []);
      setJobs(jobsRes.data || []);

      // If preselected job, set the client
      if (preselectedJobId && jobsRes.data) {
        const job = jobsRes.data.find(j => j.id === preselectedJobId);
        if (job?.client_id) {
          form.setValue("client_id", job.client_id);
        }
      }
    };

    fetchData();
  }, [tenant?.id, open, preselectedJobId, form]);

  const generateInvoiceNumber = () => {
    const prefix = "INV";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  const onSubmit = async (values: InvoiceFormValues) => {
    if (!tenant?.id) return;

    setIsLoading(true);
    try {
      const invoiceData = {
        tenant_id: tenant.id,
        invoice_number: generateInvoiceNumber(),
        client_id: values.client_id,
        job_id: values.job_id || null,
        due_date: format(values.due_date, "yyyy-MM-dd"),
        notes: values.notes || null,
        subtotal,
        tax_amount: taxAmount,
        total,
        status: "draft" as const,
      };

      const { data: newInvoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert(invoiceData)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Insert line items
      const lineItemsData = values.line_items.map((item) => ({
        invoice_id: newInvoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
        item_type: item.item_type,
      }));

      const { error: itemsError } = await supabase
        .from("invoice_line_items")
        .insert(lineItemsData);

      if (itemsError) throw itemsError;

      // Mark parts as added to invoice if we have a job selected
      if (values.job_id) {
        const partLineItems = values.line_items.filter((item) => item.item_type === "part");
        if (partLineItems.length > 0) {
          await supabase
            .from("job_parts")
            .update({ added_to_invoice: true })
            .eq("job_id", values.job_id)
            .eq("added_to_invoice", false);
        }
      }

      toast.success("Invoice created successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast.error("Failed to create invoice");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJobChange = async (jobId: string) => {
    form.setValue("job_id", jobId);
    const job = jobs.find(j => j.id === jobId);
    if (job?.client_id) {
      form.setValue("client_id", job.client_id);
    }

    // Fetch parts for this job that haven't been invoiced yet
    if (jobId && tenant?.id) {
      const { data: parts } = await supabase
        .from("job_parts")
        .select("id, part_name, part_number, quantity, unit_cost, added_to_invoice")
        .eq("job_id", jobId)
        .eq("added_to_invoice", false);

      setJobParts(parts || []);
    } else {
      setJobParts([]);
    }
  };

  const importPartsAsLineItems = async () => {
    if (jobParts.length === 0) return;

    const newItems = jobParts.map((part) => ({
      description: part.part_number 
        ? `${part.part_name} (#${part.part_number})`
        : part.part_name,
      quantity: part.quantity,
      unit_price: part.unit_cost,
      item_type: "part",
    }));

    // Get current items and append new ones
    const currentItems = form.getValues("line_items");
    // Filter out empty first item if it exists
    const filteredItems = currentItems.filter(
      (item) => item.description.trim() !== "" || item.unit_price > 0
    );

    form.setValue("line_items", [...filteredItems, ...newItems]);
    
    toast.success(`Imported ${jobParts.length} parts`);
    setJobParts([]);
  };

  const uninvoicedPartsTotal = jobParts.reduce(
    (sum, part) => sum + part.quantity * part.unit_cost,
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="invoice-form-dialog">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Generate a new invoice for a client or completed job
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client" />
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
                name="job_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Linked Job</FormLabel>
                    <Select onValueChange={handleJobChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select job (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {jobs.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.title}
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
                name="due_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date *</FormLabel>
                    <Popover open={dueDateCalendarOpen} onOpenChange={setDueDateCalendarOpen}>
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
                            setDueDateCalendarOpen(false);
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

            {/* Import Parts Banner */}
            {jobParts.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    This job has <strong>{jobParts.length} parts</strong> (${uninvoicedPartsTotal.toFixed(2)}) not yet invoiced
                  </span>
                </div>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={importPartsAsLineItems}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Import Parts
                </Button>
              </div>
            )}

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Line Items</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ description: "", quantity: 1, unit_price: 0, item_type: "service" })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <FormField
                      control={form.control}
                      name={`line_items.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          {index === 0 && <FormLabel className="text-xs">Description</FormLabel>}
                          <FormControl>
                            <Input placeholder="Service description" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name={`line_items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          {index === 0 && <FormLabel className="text-xs">Qty</FormLabel>}
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name={`line_items.${index}.unit_price`}
                      render={({ field }) => (
                        <FormItem>
                          {index === 0 && <FormLabel className="text-xs">Unit Price</FormLabel>}
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="text-sm font-medium">
                      ${(watchedItems[index]?.quantity * watchedItems[index]?.unit_price || 0).toFixed(2)}
                    </span>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tax ({taxRate}%)</span>
                <span>${taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes for the invoice..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Invoice"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
