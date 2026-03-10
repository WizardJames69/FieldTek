import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
import { Plus, MoreHorizontal, Pencil, Copy, Trash2, Globe, GlobeLock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useWorkflowTemplates,
  useCreateWorkflowTemplate,
  useDeleteWorkflowTemplate,
  useDuplicateWorkflowTemplate,
  useUpdateWorkflowTemplate,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
  type WorkflowTemplate,
} from '@/hooks/useWorkflowTemplates';
import { WorkflowTemplateEditor } from './WorkflowTemplateEditor';

const createSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  category: z.string().min(1, 'Category is required'),
  equipment_type: z.string().optional().or(z.literal('')),
});

type CreateFormValues = z.infer<typeof createSchema>;

const categoryColors: Record<string, string> = {
  installation: 'bg-blue-100 text-blue-800',
  repair: 'bg-red-100 text-red-800',
  maintenance: 'bg-green-100 text-green-800',
  inspection: 'bg-purple-100 text-purple-800',
  diagnostic: 'bg-amber-100 text-amber-800',
};

export function WorkflowTemplateList() {
  const { data: templates, isLoading } = useWorkflowTemplates();
  const createTemplate = useCreateWorkflowTemplate();
  const deleteTemplate = useDeleteWorkflowTemplate();
  const duplicateTemplate = useDuplicateWorkflowTemplate();
  const updateTemplate = useUpdateWorkflowTemplate();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowTemplate | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', category: 'maintenance', equipment_type: '' },
  });

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleCreate = async (values: CreateFormValues) => {
    try {
      const newTemplate = await createTemplate.mutateAsync({
        name: values.name,
        category: values.category as TemplateCategory,
        equipment_type: values.equipment_type || undefined,
      });
      setCreateOpen(false);
      form.reset();
      setEditingId(newTemplate.id);
      toast.success('Template created');
    } catch (err: any) {
      if (err.message?.includes('duplicate key')) {
        toast.error('A template with this name already exists');
      } else {
        toast.error(err.message || 'Failed to create template');
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTemplate.mutateAsync(deleteTarget.id);
      toast.success('Template deleted');
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete template');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateTemplate.mutateAsync(id);
      toast.success('Template duplicated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate template');
    }
  };

  const handleTogglePublish = async (template: WorkflowTemplate) => {
    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        is_published: !template.is_published,
      });
      toast.success(template.is_published ? 'Template unpublished' : 'Template published');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update template');
    }
  };

  // ── Filter ───────────────────────────────────────────────────────────

  const filtered = (templates ?? []).filter((t) => {
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    return true;
  });

  // ── Edit mode ────────────────────────────────────────────────────────

  if (editingId) {
    return <WorkflowTemplateEditor templateId={editingId} onBack={() => setEditingId(null)} />;
  }

  // ── List mode ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Workflow Templates</CardTitle>
              <CardDescription>Define step-by-step workflows for field operations</CardDescription>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-2 mb-4">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {TEMPLATE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template list */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {(templates ?? []).length === 0 ? 'No workflow templates yet. Create your first one.' : 'No templates match the current filter.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => {
                const stepCount = t.workflow_template_steps?.[0]?.count ?? 0;
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setEditingId(t.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{t.name}</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[t.category] || ''}`}>
                            {t.category}
                          </span>
                          {t.is_published ? (
                            <Badge variant="default" className="text-xs h-5">Published</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs h-5">Draft</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span>{stepCount} step{stepCount !== 1 ? 's' : ''}</span>
                          {t.equipment_type && <span>{t.equipment_type}</span>}
                          {t.estimated_duration_minutes && <span>{t.estimated_duration_minutes} min</span>}
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingId(t.id); }}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleTogglePublish(t); }}>
                          {t.is_published ? (
                            <><GlobeLock className="h-4 w-4 mr-2" /> Unpublish</>
                          ) : (
                            <><Globe className="h-4 w-4 mr-2" /> Publish</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(t.id); }}>
                          <Copy className="h-4 w-4 mr-2" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Workflow Template</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. AC Unit Maintenance" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TEMPLATE_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="equipment_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment Type (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. HVAC, Elevator" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createTemplate.isPending}>
                  {createTemplate.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow Template</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}" and all its steps. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
