/**
 * Workstream E (Slice 1) — technician offline checklist + status sync.
 *
 * Exercises the IndexedDB offline queue end to end in the technician UI:
 *   1. checklist toggle + item notes made while offline are queued
 *      ('checklist_completion_update'), shown optimistically, and replayed to
 *      job_checklist_completions on reconnect
 *   2. completing a job offline queues 'job_status_update' including
 *      resolutionNotes, and the replay persists scheduled_jobs.resolution_notes
 *      (regression for the dropped-resolution-notes replay bug)
 *
 * The service worker is irrelevant here (Playwright blocks SWs globally and
 * `npm run dev` ships none) — offline behavior under test is the explicit
 * IndexedDB layer driven by navigator.onLine, which context.setOffline()
 * controls in Chromium. IMPORTANT: never reload the page while offline; the
 * dev server would be unreachable.
 */
import { test, expect, Page } from '@playwright/test';
import { getAdminClient } from '../helpers/supabase-admin';
import * as fs from 'fs';
import * as path from 'path';

const JOB_TITLE = 'E2E Offline - Furnace Maintenance';
const CHECKLIST_ITEMS = [
  'E2E Offline Item 1',
  'E2E Offline Item 2',
  'E2E Offline Item 3',
] as const;
const ITEM_NOTES = 'Filter replaced, verified airflow at supply register';
const RESOLUTION_TEXT = 'Completed furnace maintenance offline; verified heat exchanger and airflow.';

let tenantId: string;
let technicianUserId: string;
let jobId: string;
let itemIds: Record<string, string> = {};

/** Local-timezone YYYY-MM-DD so the job lands in the Today tab. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Read all records of a fieldtek-offline IndexedDB store from the page. */
async function readIdbStore(page: Page, storeName: string): Promise<Record<string, any>[]> {
  return page.evaluate(async (store) => {
    return await new Promise<Record<string, any>[]>((resolve, reject) => {
      const open = indexedDB.open('fieldtek-offline');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(store)) {
          db.close();
          resolve([]);
          return;
        }
        const req = db.transaction([store], 'readonly').objectStore(store).getAll();
        req.onsuccess = () => {
          db.close();
          resolve(req.result || []);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      };
    });
  }, storeName);
}

/** Navigate to /my-jobs and wait until the seeded job + checklist are cached. */
async function primeOfflineCache(page: Page) {
  await page.goto('/my-jobs');
  await expect(page.getByText(JOB_TITLE).first()).toBeVisible({ timeout: 20_000 });

  // The caching effect runs after the my-jobs query succeeds — never go
  // offline before IndexedDB actually holds the job and its checklist.
  await expect
    .poll(
      async () => {
        const cachedJobs = await readIdbStore(page, 'cached_jobs');
        if (!cachedJobs.some((j) => j.id === jobId)) return 'job missing';
        const checklists = await readIdbStore(page, 'cached_checklists');
        const entry = checklists.find((c) => c.jobId === jobId);
        return entry?.items?.length ?? 0;
      },
      { timeout: 20_000 }
    )
    .toBe(CHECKLIST_ITEMS.length);
}

/** Reconnect and drain the sync queue, falling back to the manual Sync button. */
async function reconnectAndDrain(page: Page) {
  await page.context().setOffline(false);

  const queueLength = async () => (await readIdbStore(page, 'sync_queue')).length;

  // Auto-sync fires on reconnect (wasOffline effect). Give it a few seconds…
  try {
    await expect.poll(queueLength, { timeout: 5_000 }).toBe(0);
    return;
  } catch {
    // …then fall back to the manual Sync button rather than the 30s interval.
  }
  const syncButton = page.getByRole('button', { name: 'Sync', exact: true });
  if (await syncButton.isVisible().catch(() => false)) {
    await syncButton.click();
  }
  await expect.poll(queueLength, { timeout: 15_000 }).toBe(0);
}

async function openJobSheet(page: Page) {
  await page.getByText(JOB_TITLE).first().click();
  await expect(page.getByText(CHECKLIST_ITEMS[0])).toBeVisible({ timeout: 10_000 });
}

test.beforeAll(async () => {
  const ctx = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '.playwright', 'e2e-context.json'), 'utf-8')
  );
  tenantId = ctx.tenantId;
  technicianUserId = ctx.userIds.technician;

  const admin = getAdminClient();

  const { data: clientForJob } = await admin
    .from('clients')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .maybeSingle();

  // Dedicated job for this spec — the shared SAMPLE_JOB stays untouched.
  const { data: job, error: jobErr } = await admin
    .from('scheduled_jobs')
    .insert({
      tenant_id: tenantId,
      title: JOB_TITLE,
      description: 'Offline sync test job created by E2E suite',
      job_type: 'Maintenance',
      priority: 'high',
      status: 'scheduled',
      scheduled_date: localToday(),
      scheduled_time: '09:00',
      client_id: clientForJob?.id ?? null,
      assigned_to: technicianUserId,
    })
    .select('id')
    .single();
  if (jobErr || !job) throw new Error(`Failed to seed offline test job: ${jobErr?.message}`);
  jobId = job.id;

  const { data: rows, error: itemsErr } = await admin
    .from('job_checklist_completions')
    .insert(
      CHECKLIST_ITEMS.map((item) => ({
        job_id: jobId,
        stage_name: 'On Site',
        checklist_item: item,
        completed: false,
      }))
    )
    .select('id, checklist_item');
  if (itemsErr || !rows) throw new Error(`Failed to seed checklist items: ${itemsErr?.message}`);
  itemIds = Object.fromEntries(rows.map((r) => [r.checklist_item, r.id]));
});

test.afterAll(async () => {
  // FK ON DELETE CASCADE removes the job's checklist rows.
  if (jobId) await getAdminClient().from('scheduled_jobs').delete().eq('id', jobId);
});

test.describe.serial('Technician offline sync', () => {
  test('checklist toggle and notes made offline sync on reconnect', async ({ page, context }) => {
    test.slow();
    await primeOfflineCache(page);

    await context.setOffline(true);
    await expect(page.getByText('Offline Mode')).toBeVisible({ timeout: 10_000 });

    await openJobSheet(page);

    // Toggle item 1 — optimistic UI + queued op, no network.
    await page.getByRole('button', { name: `Toggle ${CHECKLIST_ITEMS[0]}` }).click();
    await expect(page.getByText(`1/${CHECKLIST_ITEMS.length}`).first()).toBeVisible();

    await expect
      .poll(async () => {
        const queue = await readIdbStore(page, 'sync_queue');
        const op = queue.find(
          (q) => q.type === 'checklist_completion_update' && q.payload?.itemId === itemIds[CHECKLIST_ITEMS[0]]
        );
        return op?.payload?.completed;
      })
      .toBe(true);

    // Item notes — expand item 2, type, save. (exact: the toggle button's
    // aria-label contains the item text as a substring)
    await page.getByRole('button', { name: CHECKLIST_ITEMS[1], exact: true }).click();
    await page.getByLabel(`Notes for ${CHECKLIST_ITEMS[1]}`).fill(ITEM_NOTES);
    await page.getByRole('button', { name: 'Save Notes' }).click();

    await expect
      .poll(async () =>
        (await readIdbStore(page, 'sync_queue')).filter((q) => q.type === 'checklist_completion_update').length
      )
      .toBe(2);

    await reconnectAndDrain(page);

    // Gold assertions: the replayed rows in the database.
    const admin = getAdminClient();
    const { data: toggled } = await admin
      .from('job_checklist_completions')
      .select('completed, completed_by, completed_at')
      .eq('id', itemIds[CHECKLIST_ITEMS[0]])
      .single();
    expect(toggled?.completed).toBe(true);
    expect(toggled?.completed_by).toBe(technicianUserId);
    expect(toggled?.completed_at).toBeTruthy();

    const { data: noted } = await admin
      .from('job_checklist_completions')
      .select('notes, completed')
      .eq('id', itemIds[CHECKLIST_ITEMS[1]])
      .single();
    expect(noted?.notes).toBe(ITEM_NOTES);
    expect(noted?.completed).toBe(false);

    // Tolerant: the status panel settles on "All synced".
    await expect(page.getByText('All synced')).toBeVisible({ timeout: 10_000 });
  });

  test('job completed offline replays status AND resolution notes', async ({ page, context }) => {
    test.slow();
    const admin = getAdminClient();
    await admin.from('scheduled_jobs').update({ status: 'in_progress' }).eq('id', jobId);

    await primeOfflineCache(page);

    await context.setOffline(true);
    await expect(page.getByText('Offline Mode')).toBeVisible({ timeout: 10_000 });

    await openJobSheet(page);

    // Complete the job — intercepted by the resolution-notes dialog. Scope to
    // the job sheet (Radix Sheet has role=dialog).
    await page.getByRole('dialog').getByRole('button', { name: 'Complete Job' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('#resolution-notes').fill(RESOLUTION_TEXT);
    await dialog.getByRole('button', { name: 'Complete Job' }).click();

    await expect
      .poll(async () => {
        const queue = await readIdbStore(page, 'sync_queue');
        const op = queue.find((q) => q.type === 'job_status_update' && q.payload?.jobId === jobId);
        return op ? { status: op.payload.status, resolutionNotes: op.payload.resolutionNotes } : null;
      })
      .toEqual({ status: 'completed', resolutionNotes: RESOLUTION_TEXT });

    await reconnectAndDrain(page);

    const { data: jobRow } = await admin
      .from('scheduled_jobs')
      .select('status, resolution_notes')
      .eq('id', jobId)
      .single();
    expect(jobRow?.status).toBe('completed');
    expect(jobRow?.resolution_notes).toBe(RESOLUTION_TEXT);
  });
});
