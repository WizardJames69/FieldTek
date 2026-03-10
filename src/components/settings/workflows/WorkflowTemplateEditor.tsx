import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Save, Eye, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useWorkflowTemplate,
  useUpdateWorkflowTemplate,
  useSaveWorkflowSteps,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
  type WorkflowTemplateStep,
} from '@/hooks/useWorkflowTemplates';
import { WorkflowStepEditor, createEmptyStep, stepFromDb, type StepDraft } from './WorkflowStepEditor';
import { WorkflowStepPreview } from './WorkflowStepPreview';

const templateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  category: z.string().min(1, 'Category is required'),
  equipment_type: z.string().optional().or(z.literal('')),
  equipment_model: z.string().optional().or(z.literal('')),
  estimated_duration_minutes: z.coerce.number().min(1).max(1440).optional().or(z.literal('')),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

interface WorkflowTemplateEditorProps {
  templateId: string;
  onBack: () => void;
}

export function WorkflowTemplateEditor({ templateId, onBack }: WorkflowTemplateEditorProps) {
  const { data: template, isLoading } = useWorkflowTemplate(templateId);
  const updateTemplate = useUpdateWorkflowTemplate();
  const saveSteps = useSaveWorkflowSteps();

  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [stepsTab, setStepsTab] = useState<string>('edit');
  const [dirty, setDirty] = useState(false);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'maintenance',
      equipment_type: '',
      equipment_model: '',
      estimated_duration_minutes: '',
    },
  });

  // Populate form when template loads
  useEffect(() => {
    if (!template) return;
    form.reset({
      name: template.name,
      description: template.description || '',
      category: template.category,
      equipment_type: template.equipment_type || '',
      equipment_model: template.equipment_model || '',
      estimated_duration_minutes: template.estimated_duration_minutes ?? '',
    });
    setSteps(template.workflow_template_steps.map(stepFromDb));
    setDirty(false);
  }, [template]);

  const markDirty = () => setDirty(true);

  // ── Step operations ──────────────────────────────────────────────────

  const addStep = () => {
    setSteps((prev) => [...prev, createEmptyStep(prev.length + 1)]);
    markDirty();
  };

  const updateStep = (localId: string, partial: Partial<StepDraft>) => {
    setSteps((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...partial } : s)));
    markDirty();
  };

  const deleteStep = (localId: string) => {
    setSteps((prev) => prev.filter((s) => s.localId !== localId));
    markDirty();
  };

  const moveStep = (localId: string, direction: 'up' | 'down') => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.localId === localId);
      if (idx < 0) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    markDirty();
  };

  // ── Save ─────────────────────────────────────────────────────────────

  const onSave = async (values: TemplateFormValues) => {
    // Validate steps
    const invalidSteps = steps.filter((s) => !s.title.trim() || !s.instruction.trim());
    if (invalidSteps.length > 0) {
      toast.error('All steps must have a title and instruction');
      return;
    }

    try {
      // Save template metadata
      await updateTemplate.mutateAsync({
        id: templateId,
        name: values.name,
        description: values.description || null,
        category: values.category as TemplateCategory,
        equipment_type: values.equipment_type || null,
        equipment_model: values.equipment_model || null,
        estimated_duration_minutes: values.estimated_duration_minutes ? Number(values.estimated_duration_minutes) : null,
      });

      // Save steps
      await saveSteps.mutateAsync({
        workflowId: templateId,
        steps: steps.map((s, idx) => ({
          step_number: idx + 1,
          stage_name: s.stage_name,
          title: s.title,
          instruction: s.instruction,
          instruction_detail: s.instruction_detail,
          media_urls: s.media_urls,
          step_type: s.step_type,
          required_inputs: s.required_inputs,
          evidence_requirements: s.evidence_requirements,
          validation_rules: s.validation_rules,
          estimated_minutes: s.estimated_minutes,
          safety_warning: s.safety_warning,
        })),
      });

      setDirty(false);
      toast.success('Workflow template saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save template');
    }
  };

  const isSaving = updateTemplate.isPending || saveSteps.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return <div className="text-center py-12 text-muted-foreground">Template not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          <Button onClick={form.handleSubmit(onSave)} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      {/* Template metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-4" onChange={markDirty}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
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
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Brief description of this workflow" className="min-h-[60px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="equipment_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Equipment Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. HVAC" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="equipment_model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Equipment Model</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Carrier 24ACC" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estimated_duration_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Est. Duration (min)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={1440} placeholder="e.g. 60" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Steps */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Steps ({steps.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Tabs value={stepsTab} onValueChange={setStepsTab}>
              <TabsList className="h-8">
                <TabsTrigger value="edit" className="text-xs h-7 px-2">
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs h-7 px-2">
                  <Eye className="h-3 w-3 mr-1" /> Preview
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {stepsTab === 'edit' ? (
            <div className="space-y-3">
              {steps.map((step, idx) => (
                <WorkflowStepEditor
                  key={step.localId}
                  step={step}
                  index={idx}
                  total={steps.length}
                  onUpdate={updateStep}
                  onDelete={deleteStep}
                  onMove={moveStep}
                />
              ))}
              <Button variant="outline" onClick={addStep} className="w-full">
                <Plus className="h-4 w-4 mr-1" /> Add Step
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {steps.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No steps defined yet</p>
              ) : (
                steps.map((step, idx) => (
                  <WorkflowStepPreview key={step.localId} step={step} index={idx} />
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
