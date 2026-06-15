/**
 * Shared vocabulary for the outcome of a technician save action (checklist
 * toggle, checklist note, job status update).
 *
 * The offline-aware mutation hooks return one of these so the calling component
 * can show the right inline feedback without re-deriving online/offline state
 * (which can race the moment the await resolves):
 *
 *   - 'synced'  — written straight to the server while online
 *   - 'queued'  — saved offline and queued for replay when the connection returns
 *   - 'failed'  — neither saved nor queued; the change still needs to be retried
 *
 * The hooks own the toast for each outcome (so copy stays consistent); the
 * component uses the returned value for inline per-item markers and Retry wiring.
 * It deliberately carries no queue/replay semantics — it only describes what the
 * last attempt did.
 */
export type SaveOutcome = 'synced' | 'queued' | 'failed';

/** True when the change is safely persisted somewhere (server or offline queue). */
export function isSaved(outcome: SaveOutcome): boolean {
  return outcome !== 'failed';
}
