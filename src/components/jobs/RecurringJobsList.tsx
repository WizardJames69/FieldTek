import { useState } from 'react';
import { format } from 'date-fns';
import { 
  RefreshCw, 
  Plus, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Play, 
  Pause,
  Calendar,
  User,
  Clock,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { 
  useRecurringJobs, 
  useToggleRecurringJobActive, 
  useDeleteRecurringJob,
  getRecurrenceDescription,
  RECURRENCE_LABELS,
  RecurringJobTemplate,
} from '@/hooks/useRecurringJobs';
import { RecurringJobFormDialog } from './RecurringJobFormDialog';
import { useUserRole } from '@/contexts/TenantContext';

export function RecurringJobsList() {
  const { data: templates, isLoading } = useRecurringJobs();
  const toggleActive = useToggleRecurringJobActive();
  const deleteMutation = useDeleteRecurringJob();
  const { isAdmin } = useUserRole();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RecurringJobTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (template: RecurringJobTemplate) => {
    setSelectedTemplate(template);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-destructive border-destructive/30';
      case 'high': return 'text-warning border-warning/30';
      case 'medium': return 'text-info border-info/30';
      default: return 'text-muted-foreground border-muted-foreground/30';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-6 bg-muted rounded w-1/3 mb-4" />
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded w-1/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const activeTemplates = templates?.filter(t => t.is_active) || [];
  const pausedTemplates = templates?.filter(t => !t.is_active) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Recurring Jobs
          </h3>
          <p className="text-sm text-muted-foreground">
            {activeTemplates.length} active templates
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        )}
      </div>

      {/* Empty State */}
      {(!templates || templates.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h4 className="font-medium text-lg mb-2">No Recurring Jobs</h4>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Set up recurring job templates to automatically generate maintenance jobs on a schedule.
            </p>
            {isAdmin && (
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Template
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Templates */}
      {activeTemplates.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Active</h4>
          <div className="grid gap-4 md:grid-cols-2">
            {activeTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={handleEdit}
                onDelete={setDeleteId}
                onToggle={(id, active) => toggleActive.mutate({ id, is_active: active })}
                isAdmin={isAdmin}
                getPriorityColor={getPriorityColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* Paused Templates */}
      {pausedTemplates.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Paused</h4>
          <div className="grid gap-4 md:grid-cols-2">
            {pausedTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={handleEdit}
                onDelete={setDeleteId}
                onToggle={(id, active) => toggleActive.mutate({ id, is_active: active })}
                isAdmin={isAdmin}
                getPriorityColor={getPriorityColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <RecurringJobFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        template={selectedTemplate}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Job Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this template. Previously generated jobs will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface TemplateCardProps {
  template: RecurringJobTemplate;
  onEdit: (template: RecurringJobTemplate) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  isAdmin: boolean;
  getPriorityColor: (priority: string) => string;
}

function TemplateCard({ 
  template, 
  onEdit, 
  onDelete, 
  onToggle, 
  isAdmin,
  getPriorityColor 
}: TemplateCardProps) {
  return (
    <Card className={`transition-all ${!template.is_active ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{template.title}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {RECURRENCE_LABELS[template.recurrence_pattern]}
              </Badge>
              <Badge variant="outline" className={`text-xs ${getPriorityColor(template.priority)}`}>
                {template.priority}
              </Badge>
              {!template.is_active && (
                <Badge variant="secondary" className="text-xs">
                  Paused
                </Badge>
              )}
            </CardDescription>
          </div>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(template)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToggle(template.id, !template.is_active)}>
                  {template.is_active ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Activate
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDelete(template.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          {getRecurrenceDescription(template)}
        </p>
        
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Next: {format(new Date(template.next_occurrence), 'MMM d, yyyy')}
          </span>
          
          {template.clients && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {template.clients.name}
            </span>
          )}
          
          {template.profiles && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {template.profiles.full_name}
            </span>
          )}
          
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {template.estimated_duration} min
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
