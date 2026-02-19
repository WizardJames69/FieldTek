import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';

export interface ChecklistItem {
  id: string;
  label: string;
  type: 'checkbox' | 'pass_fail' | 'measurement' | 'text';
  unit?: string;
  required?: boolean;
}

interface ChecklistItemEditorProps {
  item: ChecklistItem;
  index: number;
  total: number;
  onUpdate: (id: string, updates: Partial<ChecklistItem>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
}

const TYPE_LABELS: Record<ChecklistItem['type'], string> = {
  checkbox: 'Checkbox',
  pass_fail: 'Pass/Fail',
  measurement: 'Measurement',
  text: 'Text',
};

export function ChecklistItemEditor({
  item,
  index,
  total,
  onUpdate,
  onDelete,
  onMove,
}: ChecklistItemEditorProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-lg border bg-card">
      {/* Reorder */}
      <div className="flex sm:flex-col gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={index === 0}
          onClick={() => onMove(item.id, 'up')}
          aria-label="Move up"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={index === total - 1}
          onClick={() => onMove(item.id, 'down')}
          aria-label="Move down"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Label */}
      <Input
        value={item.label}
        onChange={(e) => onUpdate(item.id, { label: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === ' ') e.stopPropagation();
        }}
        placeholder="Checklist item label"
        className="flex-1 min-w-0"
      />

      {/* Type */}
      <Select
        value={item.type}
        onValueChange={(val) =>
          onUpdate(item.id, {
            type: val as ChecklistItem['type'],
            unit: val !== 'measurement' ? undefined : item.unit,
          })
        }
      >
        <SelectTrigger className="w-[130px] shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Unit (measurement only) */}
      {item.type === 'measurement' && (
        <Input
          value={item.unit || ''}
          onChange={(e) => onUpdate(item.id, { unit: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === ' ') e.stopPropagation();
          }}
          placeholder="Unit (e.g. PSI)"
          className="w-[100px] shrink-0"
        />
      )}

      {/* Required toggle */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Switch
          checked={item.required ?? false}
          onCheckedChange={(checked) => onUpdate(item.id, { required: checked })}
        />
        <span className="text-xs text-muted-foreground">Req.</span>
      </div>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
        onClick={() => onDelete(item.id)}
        aria-label="Delete item"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
