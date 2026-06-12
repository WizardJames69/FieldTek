import { describe, it, expect } from 'vitest';
import {
  buildJobStatusUpdate,
  buildChecklistCompletionUpdate,
} from './offlineReplay';

describe('buildJobStatusUpdate', () => {
  it('includes resolution_notes when resolutionNotes is present', () => {
    const update = buildJobStatusUpdate({
      jobId: 'job-1',
      status: 'completed',
      notes: 'wrap-up note',
      resolutionNotes: 'Replaced capacitor and tested system',
    });

    expect(update.status).toBe('completed');
    expect(update.notes).toBe('wrap-up note');
    expect(update.resolution_notes).toBe('Replaced capacitor and tested system');
    expect(update.updated_at).toEqual(expect.any(String));
  });

  it('omits resolution_notes when resolutionNotes is absent', () => {
    const update = buildJobStatusUpdate({
      jobId: 'job-1',
      status: 'in_progress',
    });

    expect(update.status).toBe('in_progress');
    expect(update).not.toHaveProperty('resolution_notes');
    expect(update.updated_at).toEqual(expect.any(String));
  });
});

describe('buildChecklistCompletionUpdate', () => {
  it('maps a check toggle to completed/completed_by/completed_at', () => {
    const update = buildChecklistCompletionUpdate({
      itemId: 'item-1',
      jobId: 'job-1',
      completed: true,
      completedBy: 'user-1',
      completedAt: '2026-06-11T10:00:00.000Z',
    });

    expect(update).toEqual({
      completed: true,
      completed_by: 'user-1',
      completed_at: '2026-06-11T10:00:00.000Z',
    });
  });

  it('maps an uncheck toggle to nulls for completed_by/completed_at', () => {
    const update = buildChecklistCompletionUpdate({
      itemId: 'item-1',
      jobId: 'job-1',
      completed: false,
      completedBy: null,
      completedAt: null,
    });

    expect(update).toEqual({
      completed: false,
      completed_by: null,
      completed_at: null,
    });
  });

  it('maps notes without touching completion fields', () => {
    const update = buildChecklistCompletionUpdate({
      itemId: 'item-1',
      jobId: 'job-1',
      notes: 'Filter replaced, checked airflow',
    });

    expect(update).toEqual({ notes: 'Filter replaced, checked airflow' });
    expect(update).not.toHaveProperty('completed');
  });

  it('returns an empty object when no update fields are present', () => {
    const update = buildChecklistCompletionUpdate({
      itemId: 'item-1',
      jobId: 'job-1',
    });

    expect(Object.keys(update)).toHaveLength(0);
  });
});
