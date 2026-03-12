import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOnlineStatus } from "./useOnlineStatus";
import { addToSyncQueue, storeEvidenceBlob, getSyncQueue } from "@/lib/offlineDb";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────

export interface EvidenceRequirement {
  photo?: boolean;
  measurement?: { unit: string; min?: number; max?: number };
  gps_required?: boolean;
  serial_scan?: boolean;
}

export type RequiredEvidenceMap = Record<string, EvidenceRequirement>;

export interface StepEvidence {
  id: string;
  tenant_id: string;
  job_id: string;
  checklist_item_id: string;
  stage_name: string;
  technician_id: string;
  evidence_type: string;
  photo_url: string | null;
  measurement_value: number | null;
  measurement_unit: string | null;
  serial_number: string | null;
  gps_location: { latitude: number; longitude: number; accuracy: number } | null;
  device_timestamp: string | null;
  created_at: string;
  verification_status: string;
  verification_details: Record<string, unknown> | null;
  ai_analysis: Record<string, unknown> | null;
}

export interface SubmitEvidenceParams {
  job_id: string;
  checklist_item_id: string;
  stage_name: string;
  step_execution_id?: string;
  evidence: {
    photo_url?: string;
    measurement_value?: number;
    measurement_unit?: string;
    serial_number?: string;
    gps_location?: { latitude: number; longitude: number; accuracy: number };
  };
  device_timestamp?: string;
}

interface VerifyResponse {
  status: "verified" | "verification_failed";
  evidence_ids: string[];
  failures?: Array<{
    type: string;
    detail?: string;
    expected_min?: number;
    expected_max?: number;
    actual?: number;
  }>;
  warnings?: Array<{
    type: string;
    detail?: string;
  }>;
}

// ── Hook: Fetch evidence for a job ─────────────────────────────

export function useJobEvidence(jobId: string | undefined) {
  return useQuery({
    queryKey: ["step-evidence", jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from("workflow_step_evidence")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as StepEvidence[];
    },
    enabled: !!jobId,
    staleTime: 30_000,
  });
}

// ── Hook: Submit evidence via edge function ────────────────────

export function useSubmitEvidence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SubmitEvidenceParams): Promise<VerifyResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("verify-step-evidence", {
        body: params,
      });

      if (response.error) {
        throw new Error(response.error.message || "Evidence verification failed");
      }

      return response.data as VerifyResponse;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["step-evidence", variables.job_id] });
    },
  });
}

// ── Hook: Upload evidence photo ────────────────────────────────

export function useUploadEvidencePhoto() {
  const { tenant } = useTenant();

  return useMutation({
    mutationFn: async ({
      jobId,
      checklistItemId,
      stepExecutionId,
      file,
    }: {
      jobId: string;
      checklistItemId: string;
      stepExecutionId?: string;
      file: File;
    }): Promise<string> => {
      if (!tenant?.id) throw new Error("No tenant context");

      const ext = file.name.split(".").pop() || "jpg";
      const keySegment = stepExecutionId || checklistItemId;
      const path = `${tenant.id}/${jobId}/${keySegment}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("job-evidence")
        .upload(path, file, { upsert: false });

      if (error) throw error;
      return path;
    },
  });
}

// ── Hook: Get required evidence for a stage template ───────────

export function useRequiredEvidence(stageName: string | undefined) {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ["required-evidence", tenant?.id, stageName],
    queryFn: async () => {
      if (!tenant?.id || !stageName) return {} as RequiredEvidenceMap;

      const { data, error } = await supabase
        .from("job_stage_templates")
        .select("required_evidence")
        .eq("tenant_id", tenant.id)
        .eq("stage_name", stageName)
        .maybeSingle();

      if (error) throw error;
      return (data?.required_evidence as RequiredEvidenceMap) ?? {};
    },
    enabled: !!tenant?.id && !!stageName,
    staleTime: 60_000,
  });
}

// ── Utility: Get evidence for a specific checklist item ────────

export function getItemEvidence(
  allEvidence: StepEvidence[],
  checklistItemId: string
): StepEvidence[] {
  return allEvidence.filter((e) => e.checklist_item_id === checklistItemId);
}

// ── Constant: Queued evidence status for offline items ────────

export const QUEUED_EVIDENCE_STATUS = "queued" as const;

// ── Hook: Offline-aware evidence submission ───────────────────

export function useOfflineAwareSubmitEvidence() {
  const { isOnline } = useOnlineStatus();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const submitEvidence = useSubmitEvidence();
  const uploadPhoto = useUploadEvidencePhoto();

  const submitOfflineEvidence = useCallback(
    async (
      params: SubmitEvidenceParams,
      photoFile?: File
    ): Promise<{ queued: boolean; result?: VerifyResponse }> => {
      if (isOnline) {
        // Online path: upload photo then verify (unchanged)
        let photoPath: string | undefined;
        if (photoFile) {
          photoPath = await uploadPhoto.mutateAsync({
            jobId: params.job_id,
            checklistItemId: params.checklist_item_id,
            file: photoFile,
          });
        }
        const submitParams = photoPath
          ? { ...params, evidence: { ...params.evidence, photo_url: photoPath } }
          : params;
        const result = await submitEvidence.mutateAsync(submitParams);
        return { queued: false, result };
      }

      // Offline path: queue for later sync
      const tenantId = tenant?.id;
      if (!tenantId) throw new Error("No tenant context for offline evidence");

      const hasBlob = !!photoFile;
      const queueId = await addToSyncQueue({
        type: "evidence_submission",
        payload: {
          tenant_id: tenantId,
          job_id: params.job_id,
          checklist_item_id: params.checklist_item_id,
          stage_name: params.stage_name,
          step_execution_id: params.step_execution_id,
          evidence: params.evidence,
          device_timestamp: params.device_timestamp,
          hasBlob,
        },
      });

      // Store photo blob separately if present
      if (photoFile) {
        await storeEvidenceBlob(queueId, photoFile);
      }

      // Optimistic update: inject a "queued" placeholder into React Query cache
      const evidenceType = params.evidence.photo_url || photoFile
        ? "photo"
        : params.evidence.measurement_value != null
          ? "measurement"
          : params.evidence.serial_number
            ? "serial_scan"
            : params.evidence.gps_location
              ? "gps_checkin"
              : "unknown";

      const placeholder: StepEvidence = {
        id: `queued-${queueId}`,
        tenant_id: tenantId,
        job_id: params.job_id,
        checklist_item_id: params.checklist_item_id,
        stage_name: params.stage_name,
        technician_id: "",
        evidence_type: evidenceType,
        photo_url: null,
        measurement_value: params.evidence.measurement_value ?? null,
        measurement_unit: params.evidence.measurement_unit ?? null,
        serial_number: params.evidence.serial_number ?? null,
        gps_location: params.evidence.gps_location ?? null,
        device_timestamp: params.device_timestamp ?? new Date().toISOString(),
        created_at: new Date().toISOString(),
        verification_status: QUEUED_EVIDENCE_STATUS,
        verification_details: null,
        ai_analysis: null,
      };

      queryClient.setQueryData<StepEvidence[]>(
        ["step-evidence", params.job_id],
        (old) => [...(old ?? []), placeholder]
      );

      toast.info("Evidence saved offline. Will sync when connected.");
      return { queued: true };
    },
    [isOnline, tenant?.id, queryClient, submitEvidence, uploadPhoto]
  );

  return {
    submitOfflineEvidence,
    isOnline,
    isPending: submitEvidence.isPending || uploadPhoto.isPending,
    isError: submitEvidence.isError,
  };
}

// ── Hook: Count queued evidence for a job ─────────────────────

export function useQueuedEvidenceCount(jobId: string | undefined) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!jobId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    getSyncQueue().then((queue) => {
      if (cancelled) return;
      const evidenceOps = queue.filter(
        (op) => op.type === "evidence_submission" && op.payload.job_id === jobId
      );
      setCount(evidenceOps.length);
    });
    return () => { cancelled = true; };
  }, [jobId]);

  return count;
}

// ── Utility: Check if item has all required evidence met ───────

export function isEvidenceComplete(
  itemEvidence: StepEvidence[],
  requirement: EvidenceRequirement | undefined
): boolean {
  if (!requirement) return true;

  if (requirement.photo) {
    const hasPhoto = itemEvidence.some(
      (e) => e.evidence_type === "photo" && e.verification_status !== "failed"
    );
    if (!hasPhoto) return false;
  }

  if (requirement.measurement) {
    const hasMeasurement = itemEvidence.some(
      (e) => e.evidence_type === "measurement" && e.verification_status !== "failed"
    );
    if (!hasMeasurement) return false;
  }

  if (requirement.serial_scan) {
    const hasSerial = itemEvidence.some(
      (e) => e.evidence_type === "serial_scan" && e.verification_status !== "failed"
    );
    if (!hasSerial) return false;
  }

  if (requirement.gps_required) {
    const hasGps = itemEvidence.some(
      (e) => e.evidence_type === "gps_checkin" && e.verification_status !== "failed"
    );
    if (!hasGps) return false;
  }

  return true;
}
