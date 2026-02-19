import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, Search, Package, Loader2, Upload, FileSpreadsheet, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface CatalogPart {
  id: string;
  part_name: string;
  part_number: string | null;
  default_unit_cost: number;
  supplier: string | null;
  category: string | null;
  created_at: string;
}

interface PartFormData {
  part_name: string;
  part_number: string;
  default_unit_cost: number;
  supplier: string;
  category: string;
}

interface CSVPart {
  part_name: string;
  part_number?: string;
  default_unit_cost?: number;
  supplier?: string;
  category?: string;
  _status?: "new" | "duplicate" | "update";
  _existingId?: string;
}

const COMMON_CATEGORIES = ["Fittings", "Filters", "Electrical", "Plumbing", "HVAC", "Tools", "Other"];

export function PartsCatalogSettings() {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<CatalogPart | null>(null);
  const [deletingPart, setDeletingPart] = useState<CatalogPart | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<CSVPart[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<"skip" | "update">("skip");
  const [formData, setFormData] = useState<PartFormData>({
    part_name: "",
    part_number: "",
    default_unit_cost: 0,
    supplier: "",
    category: "",
  });
  const { data: parts = [], isLoading } = useQuery({
    queryKey: ["parts-catalog", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from("parts_catalog")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("part_name");
      if (error) throw error;
      return data as CatalogPart[];
    },
    enabled: !!tenant?.id,
  });

  const filteredParts = parts.filter(
    (part) =>
      part.part_name.toLowerCase().includes(search.toLowerCase()) ||
      part.part_number?.toLowerCase().includes(search.toLowerCase()) ||
      part.supplier?.toLowerCase().includes(search.toLowerCase()) ||
      part.category?.toLowerCase().includes(search.toLowerCase())
  );

  const createPart = useMutation({
    mutationFn: async (data: PartFormData) => {
      const { error } = await supabase.from("parts_catalog").insert({
        tenant_id: tenant?.id,
        part_name: data.part_name,
        part_number: data.part_number || null,
        default_unit_cost: data.default_unit_cost,
        supplier: data.supplier || null,
        category: data.category || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts-catalog", tenant?.id] });
      toast.success("Part added to catalog");
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error("Failed to add part");
    },
  });

  const updatePart = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PartFormData }) => {
      const { error } = await supabase
        .from("parts_catalog")
        .update({
          part_name: data.part_name,
          part_number: data.part_number || null,
          default_unit_cost: data.default_unit_cost,
          supplier: data.supplier || null,
          category: data.category || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts-catalog", tenant?.id] });
      toast.success("Part updated");
      setEditingPart(null);
      resetForm();
    },
    onError: () => {
      toast.error("Failed to update part");
    },
  });

  const deletePart = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parts_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts-catalog", tenant?.id] });
      toast.success("Part deleted from catalog");
      setDeletingPart(null);
    },
    onError: () => {
      toast.error("Failed to delete part");
    },
  });

  const resetForm = () => {
    setFormData({
      part_name: "",
      part_number: "",
      default_unit_cost: 0,
      supplier: "",
      category: "",
    });
  };

  const openEditDialog = (part: CatalogPart) => {
    setEditingPart(part);
    setFormData({
      part_name: part.part_name,
      part_number: part.part_number || "",
      default_unit_cost: Number(part.default_unit_cost),
      supplier: part.supplier || "",
      category: part.category || "",
    });
  };

  const handleSubmit = () => {
    if (!formData.part_name.trim()) {
      toast.error("Part name is required");
      return;
    }
    if (editingPart) {
      updatePart.mutate({ id: editingPart.id, data: formData });
    } else {
      createPart.mutate(formData);
    }
  };

  const isDialogOpen = isAddDialogOpen || !!editingPart;
  const closeDialog = () => {
    setIsAddDialogOpen(false);
    setEditingPart(null);
    resetForm();
  };

  const parseCSV = (text: string): CSVPart[] => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/"/g, ""));
    const nameIdx = headers.findIndex((h) => h.includes("name") || h === "part");
    const numberIdx = headers.findIndex((h) => h.includes("number") || h.includes("sku"));
    const costIdx = headers.findIndex((h) => h.includes("cost") || h.includes("price"));
    const supplierIdx = headers.findIndex((h) => h.includes("supplier") || h.includes("vendor"));
    const categoryIdx = headers.findIndex((h) => h.includes("category") || h.includes("type"));

    if (nameIdx === -1) {
      toast.error("CSV must have a 'part_name' or 'name' column");
      return [];
    }

    const parts: CSVPart[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const partName = values[nameIdx]?.trim();
      if (!partName) continue;

      parts.push({
        part_name: partName,
        part_number: numberIdx >= 0 ? values[numberIdx] || undefined : undefined,
        default_unit_cost: costIdx >= 0 ? parseFloat(values[costIdx]) || 0 : 0,
        supplier: supplierIdx >= 0 ? values[supplierIdx] || undefined : undefined,
        category: categoryIdx >= 0 ? values[categoryIdx] || undefined : undefined,
      });
    }
    return parts;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        // Check for duplicates by part_number
        const partsWithStatus = parsed.map((csvPart) => {
          if (csvPart.part_number) {
            const existing = parts.find(
              (p) => p.part_number?.toLowerCase() === csvPart.part_number?.toLowerCase()
            );
            if (existing) {
              return { ...csvPart, _status: "duplicate" as const, _existingId: existing.id };
            }
          }
          return { ...csvPart, _status: "new" as const };
        });
        setImportData(partsWithStatus);
        setIsImportDialogOpen(true);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleBulkImport = async () => {
    if (!tenant?.id || importData.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < importData.length; i++) {
      const part = importData[i];
      
      if (part._status === "duplicate") {
        if (duplicateAction === "skip") {
          skipped++;
        } else if (duplicateAction === "update" && part._existingId) {
          const { error } = await supabase
            .from("parts_catalog")
            .update({
              part_name: part.part_name,
              default_unit_cost: part.default_unit_cost || 0,
              supplier: part.supplier || null,
              category: part.category || null,
            })
            .eq("id", part._existingId);
          if (error) {
            failed++;
          } else {
            updated++;
          }
        }
      } else {
        const { error } = await supabase.from("parts_catalog").insert({
          tenant_id: tenant.id,
          part_name: part.part_name,
          part_number: part.part_number || null,
          default_unit_cost: part.default_unit_cost || 0,
          supplier: part.supplier || null,
          category: part.category || null,
        });

        if (error) {
          failed++;
        } else {
          inserted++;
        }
      }
      setImportProgress(Math.round(((i + 1) / importData.length) * 100));
    }

    setIsImporting(false);
    setIsImportDialogOpen(false);
    setImportData([]);
    setDuplicateAction("skip");
    queryClient.invalidateQueries({ queryKey: ["parts-catalog", tenant.id] });

    const messages: string[] = [];
    if (inserted > 0) messages.push(`${inserted} added`);
    if (updated > 0) messages.push(`${updated} updated`);
    if (skipped > 0) messages.push(`${skipped} skipped`);
    if (failed > 0) messages.push(`${failed} failed`);
    
    if (failed > 0) {
      toast.warning(`Import complete: ${messages.join(", ")}`);
    } else {
      toast.success(`Import complete: ${messages.join(", ")}`);
    }
  };

  const downloadTemplate = () => {
    const csv = "part_name,part_number,default_unit_cost,supplier,category\n\"Example Part\",\"SKU-001\",25.99,\"Home Depot\",\"Fittings\"";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "parts_catalog_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Parts Catalog
            </CardTitle>
            <CardDescription>
              Manage commonly used parts for quick selection during jobs
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Part
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search parts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : parts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No parts in catalog</p>
            <p className="text-sm">Add commonly used parts for quick selection during jobs</p>
          </div>
        ) : filteredParts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No parts match your search</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Name</TableHead>
                  <TableHead>Part Number</TableHead>
                  <TableHead>Default Cost</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParts.map((part) => (
                  <TableRow key={part.id}>
                    <TableCell className="font-medium">{part.part_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {part.part_number || "—"}
                    </TableCell>
                    <TableCell>${Number(part.default_unit_cost).toFixed(2)}</TableCell>
                    <TableCell>{part.supplier || "—"}</TableCell>
                    <TableCell>{part.category || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(part)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingPart(part)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {parts.length} {parts.length === 1 ? "part" : "parts"} in catalog
        </p>
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPart ? "Edit Part" : "Add Part to Catalog"}</DialogTitle>
            <DialogDescription>
              {editingPart
                ? "Update the part details"
                : "Add a commonly used part for quick selection"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="part_name">Part Name *</Label>
              <Input
                id="part_name"
                placeholder="e.g., 3/4 inch copper elbow"
                value={formData.part_name}
                onChange={(e) => setFormData({ ...formData, part_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="part_number">Part/SKU Number</Label>
                <Input
                  id="part_number"
                  placeholder="Optional"
                  value={formData.part_number}
                  onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_unit_cost">Default Cost ($)</Label>
                <Input
                  id="default_unit_cost"
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.default_unit_cost}
                  onChange={(e) =>
                    setFormData({ ...formData, default_unit_cost: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                placeholder="e.g., Home Depot"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {COMMON_CATEGORIES.map((cat) => (
                  <Button
                    key={cat}
                    type="button"
                    variant={formData.category === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        category: formData.category === cat ? "" : cat,
                      })
                    }
                  >
                    {cat}
                  </Button>
                ))}
              </div>
              <Input
                placeholder="Or enter custom category..."
                value={COMMON_CATEGORIES.includes(formData.category) ? "" : formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createPart.isPending || updatePart.isPending}
            >
              {createPart.isPending || updatePart.isPending
                ? "Saving..."
                : editingPart
                ? "Update Part"
                : "Add Part"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPart} onOpenChange={(open) => !open && setDeletingPart(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Part?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deletingPart?.part_name}" from the catalog? This
              won't affect parts already added to jobs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPart && deletePart.mutate(deletingPart.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePart.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => !open && !isImporting && setIsImportDialogOpen(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Parts from CSV
            </DialogTitle>
            <DialogDescription>
              Review the parts below before importing. {importData.length} parts found.
            </DialogDescription>
          </DialogHeader>

          {isImporting ? (
            <div className="py-8 space-y-4">
              <Progress value={importProgress} />
              <p className="text-center text-sm text-muted-foreground">
                Importing... {importProgress}%
              </p>
            </div>
          ) : (
            <>
              {(() => {
                const duplicates = importData.filter((p) => p._status === "duplicate");
                const newParts = importData.filter((p) => p._status === "new");
                return duplicates.length > 0 ? (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {duplicates.length} duplicate{duplicates.length !== 1 ? "s" : ""} found (by part number)
                    </p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="duplicateAction"
                          checked={duplicateAction === "skip"}
                          onChange={() => setDuplicateAction("skip")}
                          className="accent-primary"
                        />
                        Skip duplicates ({newParts.length} new will be added)
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="duplicateAction"
                          checked={duplicateAction === "update"}
                          onChange={() => setDuplicateAction("update")}
                          className="accent-primary"
                        />
                        Update existing parts
                      </label>
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="max-h-[300px] overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Part Name</TableHead>
                      <TableHead>Part Number</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Supplier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importData.slice(0, 50).map((part, idx) => (
                      <TableRow key={idx} className={part._status === "duplicate" ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                        <TableCell>
                          {part._status === "duplicate" ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                              {duplicateAction === "skip" ? "Skip" : "Update"}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                              New
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{part.part_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {part.part_number || "—"}
                        </TableCell>
                        <TableCell>${(part.default_unit_cost || 0).toFixed(2)}</TableCell>
                        <TableCell>{part.supplier || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {importData.length > 50 && (
                <p className="text-xs text-muted-foreground">
                  Showing first 50 of {importData.length} parts
                </p>
              )}
            </>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadTemplate}
              className="sm:mr-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button onClick={handleBulkImport} disabled={isImporting || importData.length === 0}>
              {isImporting ? "Importing..." : `Import ${importData.length} Parts`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
