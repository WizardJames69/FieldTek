/**
 * Pure builders that map queued offline operation payloads to the column
 * updates replayed against Supabase. Kept free of IndexedDB/supabase imports
 * so the field mapping is unit-testable — silent field drops here mean data
 * recorded offline never reaches the server.
 */

export interface JobStatusUpdatePayload {
  jobId: string;
  status: string;
  notes?: string;
  resolutionNotes?: string;
}

export interface ChecklistCompletionUpdatePayload {
  itemId: string;
  jobId: string;
  completed?: boolean;
  completedBy?: string | null;
  completedAt?: string | null;
  notes?: string;
}

export function buildJobStatusUpdate(
  payload: JobStatusUpdatePayload
): Record<string, unknown> {
  const update: Record<string, unknown> = {
    status: payload.status,
    notes: payload.notes,
    updated_at: new Date().toISOString(),
  };
  if (payload.resolutionNotes) {
    update.resolution_notes = payload.resolutionNotes;
  }
  return update;
}

export function buildChecklistCompletionUpdate(
  payload: ChecklistCompletionUpdatePayload
): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  if (payload.completed !== undefined) {
    update.completed = payload.completed;
    update.completed_by = payload.completedBy ?? null;
    update.completed_at = payload.completedAt ?? null;
  }
  if (payload.notes !== undefined) {
    update.notes = payload.notes;
  }
  return update;
}
