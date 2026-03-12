import { useState, useRef } from "react";
import { Camera, MapPin, Hash, Ruler, Loader2, CheckCircle2, AlertTriangle, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type EvidenceRequirement,
  type StepEvidence,
  useOfflineAwareSubmitEvidence,
  QUEUED_EVIDENCE_STATUS,
} from "@/hooks/useStepEvidence";

interface StepEvidenceCaptureProps {
  jobId: string;
  checklistItemId: string;
  stageName: string;
  requirement: EvidenceRequirement;
  existingEvidence: StepEvidence[];
  onEvidenceSubmitted?: () => void;
}

export function StepEvidenceCapture({
  jobId,
  checklistItemId,
  stageName,
  requirement,
  existingEvidence,
  onEvidenceSubmitted,
}: StepEvidenceCaptureProps) {
  return (
    <div className="mt-2 space-y-3 border-t border-border/50 pt-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        Step Verification
      </div>

      {requirement.photo && (
        <PhotoCapture
          jobId={jobId}
          checklistItemId={checklistItemId}
          stageName={stageName}
          existing={existingEvidence.filter((e) => e.evidence_type === "photo")}
          onSubmitted={onEvidenceSubmitted}
        />
      )}

      {requirement.measurement && (
        <MeasurementCapture
          jobId={jobId}
          checklistItemId={checklistItemId}
          stageName={stageName}
          unit={requirement.measurement.unit}
          min={requirement.measurement.min}
          max={requirement.measurement.max}
          existing={existingEvidence.filter((e) => e.evidence_type === "measurement")}
          onSubmitted={onEvidenceSubmitted}
        />
      )}

      {requirement.serial_scan && (
        <SerialCapture
          jobId={jobId}
          checklistItemId={checklistItemId}
          stageName={stageName}
          existing={existingEvidence.filter((e) => e.evidence_type === "serial_scan")}
          onSubmitted={onEvidenceSubmitted}
        />
      )}

      {requirement.gps_required && (
        <GPSCheckin
          jobId={jobId}
          checklistItemId={checklistItemId}
          stageName={stageName}
          existing={existingEvidence.filter((e) => e.evidence_type === "gps_checkin")}
          onSubmitted={onEvidenceSubmitted}
        />
      )}
    </div>
  );
}

// ── Queued Badge ──────────────────────────────────────────────

function QueuedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
      <CloudOff className="h-3.5 w-3.5" /> Queued
    </span>
  );
}

function StatusIndicator({ existing }: { existing: StepEvidence[] }) {
  const hasQueued = existing.some((e) => e.verification_status === QUEUED_EVIDENCE_STATUS);
  const hasVerified = existing.some((e) => e.verification_status !== "failed" && e.verification_status !== QUEUED_EVIDENCE_STATUS);

  if (hasQueued && !hasVerified) return <QueuedBadge />;
  if (hasVerified) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  return null;
}

// ── Photo Capture ──────────────────────────────────────────────

function PhotoCapture({
  jobId,
  checklistItemId,
  stageName,
  existing,
  onSubmitted,
}: {
  jobId: string;
  checklistItemId: string;
  stageName: string;
  existing: StepEvidence[];
  onSubmitted?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { submitOfflineEvidence, isPending, isError } = useOfflineAwareSubmitEvidence();
  const hasVerified = existing.some((e) => e.verification_status !== "failed" && e.verification_status !== QUEUED_EVIDENCE_STATUS);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await submitOfflineEvidence(
        {
          job_id: jobId,
          checklist_item_id: checklistItemId,
          stage_name: stageName,
          evidence: {},
          device_timestamp: new Date().toISOString(),
        },
        file
      );
      onSubmitted?.();
    } catch {
      // Error handled by mutation state / toast
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
        data-testid="evidence-photo-input"
      />
      <Button
        variant="outline"
        className="h-12 text-sm gap-2"
        onClick={() => fileRef.current?.click()}
        disabled={isPending}
        data-testid="evidence-photo-button"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        {hasVerified ? "Retake Photo" : "Take Photo"}
      </Button>
      <StatusIndicator existing={existing} />
      {isError && (
        <span className="text-sm text-destructive font-medium">Upload failed</span>
      )}
    </div>
  );
}

// ── Measurement Capture ────────────────────────────────────────

function MeasurementCapture({
  jobId,
  checklistItemId,
  stageName,
  unit,
  min,
  max,
  existing,
  onSubmitted,
}: {
  jobId: string;
  checklistItemId: string;
  stageName: string;
  unit: string;
  min?: number;
  max?: number;
  existing: StepEvidence[];
  onSubmitted?: () => void;
}) {
  const [value, setValue] = useState("");
  const { submitOfflineEvidence, isPending } = useOfflineAwareSubmitEvidence();

  const handleSubmit = async () => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    try {
      await submitOfflineEvidence({
        job_id: jobId,
        checklist_item_id: checklistItemId,
        stage_name: stageName,
        evidence: { measurement_value: numValue, measurement_unit: unit },
        device_timestamp: new Date().toISOString(),
      });
      onSubmitted?.();
    } catch {
      // Error handled by mutation state / toast
    }
  };

  const numVal = parseFloat(value);
  const outOfRange =
    !isNaN(numVal) &&
    ((min != null && numVal < min) || (max != null && numVal > max));

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Ruler className="h-4 w-4 text-muted-foreground" />
        <div className="flex items-center gap-2 flex-1">
          <Input
            type="number"
            placeholder={min != null && max != null ? `${min}–${max}` : "Value"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-12 text-sm w-28"
            data-testid="evidence-measurement-input"
          />
          <span className="text-sm text-muted-foreground font-medium">{unit}</span>
        </div>
        <Button
          variant="outline"
          className="h-12 text-sm"
          onClick={handleSubmit}
          disabled={!value || isPending}
          data-testid="evidence-measurement-submit"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Save"
          )}
        </Button>
        <StatusIndicator existing={existing} />
      </div>
      {outOfRange && (
        <div className="flex items-center gap-1.5 text-sm text-amber-500 dark:text-amber-400 font-medium">
          <AlertTriangle className="h-4 w-4" />
          {min != null && max != null
            ? `Expected range: ${min}–${max} ${unit}`
            : min != null
              ? `Minimum: ${min} ${unit}`
              : `Maximum: ${max} ${unit}`}
        </div>
      )}
    </div>
  );
}

// ── Serial / QR Scan ───────────────────────────────────────────

function SerialCapture({
  jobId,
  checklistItemId,
  stageName,
  existing,
  onSubmitted,
}: {
  jobId: string;
  checklistItemId: string;
  stageName: string;
  existing: StepEvidence[];
  onSubmitted?: () => void;
}) {
  const [serial, setSerial] = useState("");
  const { submitOfflineEvidence, isPending } = useOfflineAwareSubmitEvidence();

  const handleSubmit = async () => {
    if (!serial.trim()) return;

    try {
      await submitOfflineEvidence({
        job_id: jobId,
        checklist_item_id: checklistItemId,
        stage_name: stageName,
        evidence: { serial_number: serial.trim() },
        device_timestamp: new Date().toISOString(),
      });
      onSubmitted?.();
    } catch {
      // Error handled by mutation state / toast
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Hash className="h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Serial number"
        value={serial}
        onChange={(e) => setSerial(e.target.value)}
        className="h-12 text-sm flex-1"
        data-testid="evidence-serial-input"
      />
      <Button
        variant="outline"
        className="h-12 text-sm"
        onClick={handleSubmit}
        disabled={!serial.trim() || isPending}
        data-testid="evidence-serial-submit"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Save"
        )}
      </Button>
      <StatusIndicator existing={existing} />
    </div>
  );
}

// ── GPS Check-in ───────────────────────────────────────────────

function GPSCheckin({
  jobId,
  checklistItemId,
  stageName,
  existing,
  onSubmitted,
}: {
  jobId: string;
  checklistItemId: string;
  stageName: string;
  existing: StepEvidence[];
  onSubmitted?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { submitOfflineEvidence, isPending } = useOfflineAwareSubmitEvidence();
  const hasVerified = existing.some((e) => e.verification_status !== "failed" && e.verification_status !== QUEUED_EVIDENCE_STATUS);

  const handleCheckin = async () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          })
      );

      await submitOfflineEvidence({
        job_id: jobId,
        checklist_item_id: checklistItemId,
        stage_name: stageName,
        evidence: {
          gps_location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
        },
        device_timestamp: new Date().toISOString(),
      });
      onSubmitted?.();
    } catch (err) {
      setError(
        err instanceof GeolocationPositionError
          ? "Location access denied"
          : "Failed to get location"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="h-12 text-sm gap-2"
          onClick={handleCheckin}
          disabled={loading || isPending}
          data-testid="evidence-gps-button"
        >
          {loading || isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
          {hasVerified ? "Re-capture Location" : "Check In (GPS)"}
        </Button>
        <StatusIndicator existing={existing} />
      </div>
      {error && (
        <div className="text-sm text-destructive font-medium">{error}</div>
      )}
      {hasVerified && existing[0]?.gps_location && (
        <div className="text-xs text-muted-foreground">
          {(existing[0].gps_location as { latitude: number; longitude: number; accuracy: number }).latitude.toFixed(5)},{" "}
          {(existing[0].gps_location as { latitude: number; longitude: number; accuracy: number }).longitude.toFixed(5)}{" "}
          (±{Math.round((existing[0].gps_location as { accuracy: number }).accuracy)}m)
        </div>
      )}
    </div>
  );
}
