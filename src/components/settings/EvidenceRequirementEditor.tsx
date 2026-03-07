import { Camera, MapPin, Hash, Ruler } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EvidenceRequirement } from "@/hooks/useStepEvidence";

interface EvidenceRequirementEditorProps {
  itemId: string;
  requirement: EvidenceRequirement;
  onChange: (itemId: string, requirement: EvidenceRequirement) => void;
}

export function EvidenceRequirementEditor({
  itemId,
  requirement,
  onChange,
}: EvidenceRequirementEditorProps) {
  const update = (partial: Partial<EvidenceRequirement>) => {
    onChange(itemId, { ...requirement, ...partial });
  };

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 mt-2">
      <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        Evidence Requirements
      </div>

      {/* Photo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-3.5 w-3.5 text-zinc-500" />
          <Label className="text-sm">Photo required</Label>
        </div>
        <Switch
          checked={requirement.photo ?? false}
          onCheckedChange={(checked) => update({ photo: checked })}
          data-testid={`evidence-req-photo-${itemId}`}
        />
      </div>

      {/* GPS */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-zinc-500" />
          <Label className="text-sm">GPS check-in required</Label>
        </div>
        <Switch
          checked={requirement.gps_required ?? false}
          onCheckedChange={(checked) => update({ gps_required: checked })}
          data-testid={`evidence-req-gps-${itemId}`}
        />
      </div>

      {/* Serial scan */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hash className="h-3.5 w-3.5 text-zinc-500" />
          <Label className="text-sm">Serial number / QR scan</Label>
        </div>
        <Switch
          checked={requirement.serial_scan ?? false}
          onCheckedChange={(checked) => update({ serial_scan: checked })}
          data-testid={`evidence-req-serial-${itemId}`}
        />
      </div>

      {/* Measurement range */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="h-3.5 w-3.5 text-zinc-500" />
            <Label className="text-sm">Measurement range</Label>
          </div>
          <Switch
            checked={!!requirement.measurement}
            onCheckedChange={(checked) =>
              update({
                measurement: checked
                  ? { unit: "", min: undefined, max: undefined }
                  : undefined,
              })
            }
            data-testid={`evidence-req-measurement-${itemId}`}
          />
        </div>

        {requirement.measurement && (
          <div className="grid grid-cols-3 gap-2 pl-5">
            <div>
              <Label className="text-xs text-zinc-500">Unit</Label>
              <Input
                value={requirement.measurement.unit}
                onChange={(e) =>
                  update({
                    measurement: { ...requirement.measurement!, unit: e.target.value },
                  })
                }
                placeholder="PSI"
                className="h-7 text-xs"
                data-testid={`evidence-req-unit-${itemId}`}
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500">Min</Label>
              <Input
                type="number"
                value={requirement.measurement.min ?? ""}
                onChange={(e) =>
                  update({
                    measurement: {
                      ...requirement.measurement!,
                      min: e.target.value ? parseFloat(e.target.value) : undefined,
                    },
                  })
                }
                placeholder="0"
                className="h-7 text-xs"
                data-testid={`evidence-req-min-${itemId}`}
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500">Max</Label>
              <Input
                type="number"
                value={requirement.measurement.max ?? ""}
                onChange={(e) =>
                  update({
                    measurement: {
                      ...requirement.measurement!,
                      max: e.target.value ? parseFloat(e.target.value) : undefined,
                    },
                  })
                }
                placeholder="500"
                className="h-7 text-xs"
                data-testid={`evidence-req-max-${itemId}`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
