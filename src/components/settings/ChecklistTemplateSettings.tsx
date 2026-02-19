import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { ChecklistItemEditor, type ChecklistItem } from './ChecklistItemEditor';
import { INDUSTRY_PRESETS, type IndustryType } from '@/types/database';
import { Plus, Copy, Save, Loader2, ClipboardList } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface TemplateRow {
  id: string;
  stage_name: string;
  job_type: string | null;
  checklist_items: ChecklistItem[] | null;
  order_index: number | null;
}

export function ChecklistTemplateSettings() {
  const { tenant, settings } = useTenant();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Selections
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [selectedJobType, setSelectedJobType] = useState<string>('');

  // Derived lists from tenant settings
  const workflowStages: string[] = (settings as any)?.workflow_stages ?? ['Start', 'In Progress', 'Review', 'Complete'];
  const jobTypes: string[] = (settings as any)?.job_types ?? ['Service', 'Maintenance', 'Repair'];
  const industry: IndustryType = (settings as any)?.industry ?? 'general';

  // Current template for the selected stage + job type
  const currentTemplate = templates.find(
    (t) => t.stage_name === selectedStage && t.job_type === selectedJobType
  );
  const items: ChecklistItem[] = currentTemplate?.checklist_items ?? [];

  // Initialize defaults
  useEffect(() => {
    if (workflowStages.length > 0 && !selectedStage) {
      setSelectedStage(workflowStages[0]);
    }
    if (jobTypes.length > 0 && !selectedJobType) {
      setSelectedJobType(jobTypes[0]);
    }
  }, [workflowStages, jobTypes]);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_stage_templates')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setTemplates(
        (data ?? []).map((row) => ({
          ...row,
          checklist_items: Array.isArray(row.checklist_items)
            ? (row.checklist_items as unknown as ChecklistItem[])
            : [],
        }))
      );
    } catch (err) {
      console.error('Error fetching templates:', err);
      toast({ title: 'Error', description: 'Failed to load checklist templates', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // ---- CRUD helpers ----

  const updateItems = (newItems: ChecklistItem[]) => {
    setTemplates((prev) => {
      const idx = prev.findIndex(
        (t) => t.stage_name === selectedStage && t.job_type === selectedJobType
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], checklist_items: newItems };
        return updated;
      }
      // Create local placeholder
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          stage_name: selectedStage,
          job_type: selectedJobType,
          checklist_items: newItems,
          order_index: prev.length,
        },
      ];
    });
  };

  const handleAddItem = () => {
    const newItem: ChecklistItem = {
      id: crypto.randomUUID(),
      label: '',
      type: 'checkbox',
      required: false,
    };
    updateItems([...items, newItem]);
  };

  const handleUpdateItem = (id: string, updates: Partial<ChecklistItem>) => {
    updateItems(items.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  };

  const handleDeleteItem = (id: string) => {
    updateItems(items.filter((i) => i.id !== id));
  };

  const handleMoveItem = (id: string, direction: 'up' | 'down') => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= items.length) return;
    const newItems = [...items];
    [newItems[idx], newItems[newIdx]] = [newItems[newIdx], newItems[idx]];
    updateItems(newItems);
  };

  // Save to DB
  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      const template = templates.find(
        (t) => t.stage_name === selectedStage && t.job_type === selectedJobType
      );
      if (!template) return;

      const { error } = await supabase
        .from('job_stage_templates')
        .upsert(
          {
            id: template.id,
            tenant_id: tenant.id,
            stage_name: selectedStage,
            job_type: selectedJobType,
            checklist_items: (template.checklist_items ?? []) as unknown as Json,
            order_index: template.order_index ?? 0,
          },
          { onConflict: 'id' }
        );

      if (error) throw error;
      toast({ title: 'Saved', description: 'Checklist template updated successfully' });
      await fetchTemplates();
    } catch (err) {
      console.error('Error saving template:', err);
      toast({ title: 'Error', description: 'Failed to save checklist template', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Duplicate current template to another job type
  const handleDuplicate = async () => {
    if (!currentTemplate || !tenant) return;
    const otherTypes = jobTypes.filter((jt) => jt !== selectedJobType);
    if (otherTypes.length === 0) return;

    // Duplicate to the next job type that doesn't already have a template for this stage
    const target = otherTypes.find(
      (jt) => !templates.some((t) => t.stage_name === selectedStage && t.job_type === jt)
    );
    if (!target) {
      toast({ title: 'Info', description: 'All job types already have templates for this stage' });
      return;
    }

    setSaving(true);
    try {
      const newItems = (currentTemplate.checklist_items ?? []).map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      }));

      const { error } = await supabase.from('job_stage_templates').insert({
        tenant_id: tenant.id,
        stage_name: selectedStage,
        job_type: target,
        checklist_items: newItems as unknown as Json,
        order_index: templates.length,
      });

      if (error) throw error;
      toast({ title: 'Duplicated', description: `Template duplicated to "${target}"` });
      setSelectedJobType(target);
      await fetchTemplates();
    } catch (err) {
      console.error('Error duplicating template:', err);
      toast({ title: 'Error', description: 'Failed to duplicate template', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Populate from industry defaults
  const handlePopulateDefaultsSync = () => {
    const defaultItems: ChecklistItem[] = [
      { id: crypto.randomUUID(), label: 'Visual inspection completed', type: 'checkbox', required: true },
      { id: crypto.randomUUID(), label: 'Safety check', type: 'pass_fail', required: true },
      { id: crypto.randomUUID(), label: 'Equipment operational test', type: 'pass_fail', required: true },
      { id: crypto.randomUUID(), label: 'Notes', type: 'text', required: false },
    ];
    updateItems(defaultItems);
    toast({ title: 'Defaults loaded', description: 'Industry defaults applied. Remember to save.' });
  };

  const hasChanges = currentTemplate != null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Checklist Templates
          </CardTitle>
          <CardDescription>
            Customize the checklists your technicians follow for each workflow stage and job type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stage selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">Workflow Stage</label>
            <Tabs value={selectedStage} onValueChange={setSelectedStage}>
              <TabsList className="flex flex-wrap gap-1 h-auto">
                {workflowStages.map((stage) => (
                  <TabsTrigger key={stage} value={stage} className="text-xs md:text-sm">
                    {stage}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Job type selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">Job Type</label>
            <Select value={selectedJobType} onValueChange={setSelectedJobType}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Select job type" />
              </SelectTrigger>
              <SelectContent>
                {jobTypes.map((jt) => (
                  <SelectItem key={jt} value={jt}>
                    {jt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Checklist items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base">
              {selectedStage} — {selectedJobType}
            </CardTitle>
            <CardDescription>
              {items.length} item{items.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            {currentTemplate && (
              <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={saving}>
                <Copy className="h-4 w-4 mr-1" />
                Duplicate
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handlePopulateDefaultsSync} disabled={saving}>
              Load Defaults
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No checklist items for this stage/job type yet.</p>
              <div className="flex gap-2 justify-center mt-4">
                <Button size="sm" onClick={handleAddItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
                <Button variant="outline" size="sm" onClick={handlePopulateDefaultsSync}>
                  Load Defaults
                </Button>
              </div>
            </div>
          ) : (
            <>
              {items.map((item, idx) => (
                <ChecklistItemEditor
                  key={item.id}
                  item={item}
                  index={idx}
                  total={items.length}
                  onUpdate={handleUpdateItem}
                  onDelete={handleDeleteItem}
                  onMove={handleMoveItem}
                />
              ))}
              <Button variant="outline" size="sm" onClick={handleAddItem} className="w-full mt-2">
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </>
          )}

          {/* Save button */}
          {hasChanges && (
            <div className="pt-4 border-t mt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
