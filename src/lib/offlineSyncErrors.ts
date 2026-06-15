/**
 * Human-readable labels and messages for offline sync failures.
 *
 * The offline sync queue stores operations keyed by a technical type
 * (`checklist_completion_update`, `job_status_update`, …) and a payload. When a
 * sync fails — transiently or permanently — technicians and admins should see a
 * plain-English message that names *what* couldn't sync and *which job* it was
 * for, never a UUID or a raw payload dump.
 *
 * These functions are deliberately pure (no IndexedDB / Supabase / sonner
 * imports) so the message wording is unit-testable. The hook layer
 * (`useOfflineSync`) resolves the job context from the cache and calls these.
 */
import type { QueuedOperation } from './offlineDb';

/** Friendly noun for each queued operation type. */
const OPERATION_LABELS: Record<QueuedOperation['type'], string> = {
  job_status_update: 'job status update',
  checklist_completion_update: 'checklist update',
  job_checklist_update: 'checklist update',
  job_notes_update: 'job note',
  evidence_submission: 'photo evidence',
};

/** Used when the operation type is unknown or has no friendly label. */
export const FALLBACK_OPERATION_LABEL = 'offline change';

/** Map a queued operation type to a friendly, non-technical noun. */
export function getOperationLabel(type: string): string {
  return OPERATION_LABELS[type as QueuedOperation['type']] ?? FALLBACK_OPERATION_LABEL;
}

/**
 * The job id is stored as `jobId` (camelCase replay payloads) or `job_id`
 * (evidence submissions). Returns null when neither is present.
 */
export function getOperationJobId(operation: {
  payload?: Record<string, unknown> | null;
}): string | null {
  const payload = operation?.payload ?? {};
  const jobId = payload.jobId ?? payload.job_id;
  return typeof jobId === 'string' && jobId.length > 0 ? jobId : null;
}

/** The subset of a cached job row we use for a human-readable label. */
export interface JobContextSource {
  title?: unknown;
  address?: unknown;
  client?: { name?: unknown; address?: unknown } | null;
}

/**
 * Derive the safest useful job context for a message: job title first, then the
 * client name, then a street address. Returns null when nothing usable exists
 * (the caller falls back to a generic message). Never returns raw payload JSON.
 */
export function getJobContextLabel(job?: JobContextSource | null): string | null {
  if (!job) return null;
  const candidates = [
    job.title,
    job.client?.name,
    job.address,
    job.client?.address,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function withIndefiniteArticle(label: string): string {
  return /^[aeiou]/i.test(label) ? `An ${label}` : `A ${label}`;
}

/**
 * Message shown when an operation fails but stays queued for retry, e.g.
 *   Couldn't sync checklist update for "AC Repair - 12 Main St" (attempt 3 of 10)
 *   Couldn't sync an offline change
 */
export function buildSyncErrorMessage(
  type: string,
  jobContext?: string | null,
  attempt?: { count: number; max: number }
): string {
  const label = getOperationLabel(type);
  let base: string;
  if (label === FALLBACK_OPERATION_LABEL && !jobContext) {
    base = "Couldn't sync an offline change";
  } else if (jobContext) {
    base = `Couldn't sync ${label} for "${jobContext}"`;
  } else {
    base = `Couldn't sync ${label}`;
  }
  if (attempt && attempt.count > 0) {
    return `${base} (attempt ${attempt.count} of ${attempt.max})`;
  }
  return base;
}

/**
 * Loud, support-facing message used when an operation is permanently dropped
 * after exceeding the retry limit, e.g.
 *   A checklist update for "Offline Drill - Real Device Test" failed after 10
 *   attempts and was removed. Contact support if this change is missing.
 */
export function buildDroppedMessage(
  type: string,
  maxRetries: number,
  jobContext?: string | null
): string {
  const label = getOperationLabel(type);
  const subject = jobContext
    ? `${withIndefiniteArticle(label)} for "${jobContext}"`
    : withIndefiniteArticle(label);
  return `${subject} failed after ${maxRetries} attempts and was removed. Contact support if this change is missing.`;
}
