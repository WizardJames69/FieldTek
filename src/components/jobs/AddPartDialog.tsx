import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, X, ImageIcon, Loader2, Sparkles, BookOpen, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const partSchema = z.object({
  part_name: z.string().min(1, "Part name is required"),
  part_number: z.string().optional(),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unit_cost: z.number().min(0, "Cost cannot be negative"),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});

type PartFormValues = z.infer<typeof partSchema>;

interface ExtractedPart {
  name: string;
  quantity: number;
  unit_cost: number;
  part_number?: string | null;
}

interface ExtractedReceiptData {
  parts?: ExtractedPart[];
  supplier?: string;
  total?: number;
  error?: string;
}

interface CatalogPart {
  id: string;
  part_name: string;
  part_number: string | null;
  default_unit_cost: number;
  supplier: string | null;
  category: string | null;
}

interface AddPartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  tenantId: string;
  userId: string;
}

const COMMON_SUPPLIERS = ["Home Depot", "Lowe's", "Supply House", "Ferguson", "Grainger"];

export function AddPartDialog({
  open,
  onOpenChange,
  jobId,
  tenantId,
  userId,
}: AddPartDialogProps) {
  const queryClient = useQueryClient();
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedParts, setExtractedParts] = useState<ExtractedPart[]>([]);
  const [saveToCatalog, setSaveToCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("manual");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch parts catalog
  const { data: catalogParts = [] } = useQuery({
    queryKey: ["parts-catalog", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts_catalog")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("part_name");
      if (error) throw error;
      return data as CatalogPart[];
    },
    enabled: open,
  });

  const filteredCatalogParts = catalogParts.filter(part =>
    part.part_name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    part.part_number?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    part.supplier?.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  const form = useForm<PartFormValues>({
    resolver: zodResolver(partSchema),
    defaultValues: {
      part_name: "",
      part_number: "",
      quantity: 1,
      unit_cost: 0,
      supplier: "",
      notes: "",
    },
  });

  const extractReceiptData = async (imageBase64: string) => {
    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-receipt", {
        body: { imageBase64 },
      });

      if (error) throw error;

      const result = data as ExtractedReceiptData;
      
      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.parts && result.parts.length > 0) {
        setExtractedParts(result.parts);
        
        // Auto-fill with the first part
        const firstPart = result.parts[0];
        form.setValue("part_name", firstPart.name);
        form.setValue("quantity", firstPart.quantity || 1);
        form.setValue("unit_cost", firstPart.unit_cost || 0);
        if (firstPart.part_number) {
          form.setValue("part_number", firstPart.part_number);
        }
        
        // Set supplier if detected
        if (result.supplier) {
          const matchingSupplier = COMMON_SUPPLIERS.find(
            s => s.toLowerCase() === result.supplier?.toLowerCase()
          );
          if (matchingSupplier) {
            setSelectedSupplier(matchingSupplier);
            form.setValue("supplier", matchingSupplier);
          } else {
            form.setValue("supplier", result.supplier);
          }
        }

        if (result.parts.length > 1) {
          toast.success(`Found ${result.parts.length} items on receipt. First item auto-filled.`);
        } else {
          toast.success("Receipt scanned! Details auto-filled.");
        }
      } else {
        toast.info("No items found on receipt. Please enter details manually.");
      }
    } catch (error) {
      console.error("Receipt extraction failed:", error);
      toast.error("Could not read receipt. Please enter details manually.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setReceiptPreview(base64);
        // Auto-extract when image is loaded
        await extractReceiptData(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setExtractedParts([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadReceipt = async (): Promise<string | null> => {
    if (!receiptFile) return null;

    const fileExt = receiptFile.name.split(".").pop();
    // Include tenantId in path for RLS enforcement
    const fileName = `${tenantId}/${jobId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("part-receipts")
      .upload(fileName, receiptFile);

    if (uploadError) throw uploadError;

    // Return just the file path, not a public URL
    // Signed URLs will be generated on-demand when viewing
    return fileName;
  };

  const addPart = useMutation({
    mutationFn: async (values: PartFormValues) => {
      setIsUploading(true);
      
      let receiptUrl: string | null = null;
      if (receiptFile) {
        receiptUrl = await uploadReceipt();
      }

      // Add to job parts
      const { error } = await supabase.from("job_parts").insert({
        job_id: jobId,
        tenant_id: tenantId,
        added_by: userId,
        part_name: values.part_name,
        part_number: values.part_number || null,
        quantity: values.quantity,
        unit_cost: values.unit_cost,
        supplier: values.supplier || selectedSupplier || null,
        notes: values.notes || null,
        receipt_url: receiptUrl,
      });

      if (error) throw error;

      // Save to catalog if checked
      if (saveToCatalog) {
        const existingPart = catalogParts.find(
          p => p.part_name.toLowerCase() === values.part_name.toLowerCase()
        );
        
        if (!existingPart) {
          await supabase.from("parts_catalog").insert({
            tenant_id: tenantId,
            part_name: values.part_name,
            part_number: values.part_number || null,
            default_unit_cost: values.unit_cost,
            supplier: values.supplier || selectedSupplier || null,
            created_by: userId,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-parts", jobId] });
      queryClient.invalidateQueries({ queryKey: ["parts-catalog", tenantId] });
      toast.success(saveToCatalog ? "Part added and saved to catalog" : "Part added to list");
      form.reset();
      setSelectedSupplier(null);
      setSaveToCatalog(false);
      clearReceipt();
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to add part");
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const handleSupplierClick = (supplier: string) => {
    if (selectedSupplier === supplier) {
      setSelectedSupplier(null);
      form.setValue("supplier", "");
    } else {
      setSelectedSupplier(supplier);
      form.setValue("supplier", supplier);
    }
  };

  const selectFromCatalog = (catalogPart: CatalogPart) => {
    form.setValue("part_name", catalogPart.part_name);
    form.setValue("part_number", catalogPart.part_number || "");
    form.setValue("unit_cost", Number(catalogPart.default_unit_cost));
    if (catalogPart.supplier) {
      const matchingSupplier = COMMON_SUPPLIERS.find(
        s => s.toLowerCase() === catalogPart.supplier?.toLowerCase()
      );
      if (matchingSupplier) {
        setSelectedSupplier(matchingSupplier);
      }
      form.setValue("supplier", catalogPart.supplier);
    }
    setActiveTab("manual");
    toast.success(`Selected "${catalogPart.part_name}" from catalog`);
  };

  const onSubmit = (values: PartFormValues) => {
    addPart.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Part</DialogTitle>
          <DialogDescription>
            Add a part from your catalog or enter details manually
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="catalog" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Catalog
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <Plus className="h-4 w-4" />
              Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search parts..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {catalogParts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No parts in catalog yet</p>
                <p className="text-xs">Add parts manually and check "Save to catalog"</p>
              </div>
            ) : filteredCatalogParts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No matching parts found</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {filteredCatalogParts.map((part) => (
                    <Button
                      key={part.id}
                      type="button"
                      variant="outline"
                      className="w-full justify-start h-auto py-3 px-4"
                      onClick={() => selectFromCatalog(part)}
                    >
                      <div className="flex flex-col items-start text-left">
                        <span className="font-medium">{part.part_name}</span>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>${Number(part.default_unit_cost).toFixed(2)}</span>
                          {part.part_number && <span>• {part.part_number}</span>}
                          {part.supplier && <span>• {part.supplier}</span>}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="part_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Part Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 3/4 inch copper elbow" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unit_cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Cost ($) *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="part_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Part/SKU Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Supplier</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_SUPPLIERS.map((supplier) => (
                      <Button
                        key={supplier}
                        type="button"
                        variant={selectedSupplier === supplier ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSupplierClick(supplier)}
                      >
                        {supplier}
                      </Button>
                    ))}
                  </div>
                  <FormField
                    control={form.control}
                    name="supplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="Or enter other supplier..."
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              setSelectedSupplier(null);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Receipt Photo with OCR */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FormLabel>Receipt Photo</FormLabel>
                    {isExtracting && (
                      <span className="inline-flex items-center text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Scanning...
                      </span>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  {receiptPreview ? (
                    <div className="relative w-full">
                      <img
                        src={receiptPreview}
                        alt="Receipt preview"
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      {isExtracting && (
                        <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center">
                          <div className="flex items-center gap-2 text-sm">
                            <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                            <span>Reading receipt...</span>
                          </div>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={clearReceipt}
                        disabled={isExtracting}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Take Photo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.removeAttribute("capture");
                            fileInputRef.current.click();
                            fileInputRef.current.setAttribute("capture", "environment");
                          }
                        }}
                      >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Choose File
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3 inline mr-1" />
                    AI will auto-extract part details from your receipt
                  </p>
                  
                  {/* Show extracted parts if multiple */}
                  {extractedParts.length > 1 && (
                    <div className="p-2 bg-muted rounded-md space-y-1">
                      <p className="text-xs font-medium">All items found:</p>
                      {extractedParts.map((part, idx) => (
                        <Button
                          key={idx}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-xs h-auto py-1"
                          onClick={() => {
                            form.setValue("part_name", part.name);
                            form.setValue("quantity", part.quantity || 1);
                            form.setValue("unit_cost", part.unit_cost || 0);
                            if (part.part_number) {
                              form.setValue("part_number", part.part_number);
                            }
                          }}
                        >
                          {part.name} - ${part.unit_cost?.toFixed(2)} × {part.quantity || 1}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any additional details..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Save to catalog checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="save-to-catalog"
                    checked={saveToCatalog}
                    onCheckedChange={(checked) => setSaveToCatalog(checked === true)}
                  />
                  <label
                    htmlFor="save-to-catalog"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Save to parts catalog for future use
                  </label>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addPart.isPending || isUploading}>
                    {addPart.isPending || isUploading ? "Adding..." : "Add Part"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
