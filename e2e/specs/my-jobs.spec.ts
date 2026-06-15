/**
 * PR-H9 — targeted technician My Jobs guardrails.
 *
 * Pilot-critical paths for the field technician:
 *   1. My Jobs loads with its three tabs, shows an assigned job, and opens a
 *      readable job detail with the checklist (never a blank/error state).
 *   2. A true empty state (Completed tab) is clearly distinguishable from a load
 *      failure.
 *   3. The shared offline-sync indicator (PR-H1) is visible app-wide — i.e. on a
 *      non-MyJobs page — after a technician queues an offline change, and clears
 *      on reconnect.
 *
 * Runs in the chromium-technician project (technician auth) which executes last,
 * so this spec's seeded job never leaks into earlier admin/dispatcher specs.
 * Like offline-technician.spec.ts, it seeds its own dedicated job + checklist and
 * tears it down. Offline behavior is driven by context.setOffline() against the
 * IndexedDB layer (Playwright blocks the service worker globally). IMPORTANT:
 * never `page.goto()` while offline — the dev server would be unreachable; all
 * offline navigation here is client-side (SPA) after warming the route online.
 */
import { test, expect, Page } from '@playwright/test';
import { getAdminClient } from '../helpers/supabase-admin';
import { MyJobsPage } from '../page-objects/MyJobsPage';
import * as fs from 'fs';
import * as path from 'path';

const JOB_TITLE = 'E2E My Jobs - Thermostat Install';
const CHECKLIST_ITEMS = ['E2E MyJobs Item A', 'E2E MyJobs Item B'] as const;

let tenantId: string;
let technicianUserId: string;
let jobId: string;

/** Local-timezone YYYY-MM-DD so the seeded job lands in the Today tab. */
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

test.beforeAll(async () => {
  const ctx = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '.playwright', 'e2e-context.json'), 'utf-8')
  );
  tenantId = ctx.tenantId;
  technicianUserId = ctx.userIds.technician;

  const admin = getAdminClient();

  // Determinism for the "Completed tab empty" assertion: the E2E technician is a
  // dedicated test user. A normal run's global-teardown wipes the tenant, but an
  // aborted prior run can leave a completed job behind (the tenant is reused), so
  // clear any completed jobs assigned to this technician up front.
  await admin
    .from('scheduled_jobs')
    .delete()
    .eq('assigned_to', technicianUserId)
    .eq('status', 'completed');

  const { data: clientForJob } = await admin
    .from('clients')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .maybeSingle();

  const { data: job, error: jobErr } = await admin
    .from('scheduled_jobs')
    .insert({
      tenant_id: tenantId,
      title: JOB_TITLE,
      description: 'My Jobs guardrail test job created by E2E suite',
      job_type: 'Installation',
      priority: 'medium',
      status: 'scheduled',
      scheduled_date: localToday(),
      scheduled_time: '10:00',
      client_id: clientForJob?.id ?? null,
      assigned_to: technicianUserId,
    })
    .select('id')
    .single();
  if (jobErr || !job) throw new Error(`Failed to seed My Jobs test job: ${jobErr?.message}`);
  jobId = job.id;

  const { error: itemsErr } = await admin.from('job_checklist_completions').insert(
    CHECKLIST_ITEMS.map((item) => ({
      job_id: jobId,
      stage_name: 'On Site',
      checklist_item: item,
      completed: false,
    }))
  );
  if (itemsErr) throw new Error(`Failed to seed checklist items: ${itemsErr.message}`);
});

test.afterAll(async () => {
  // FK ON DELETE CASCADE removes the job's checklist rows.
  if (jobId) await getAdminClient().from('scheduled_jobs').delete().eq('id', jobId);
});

test.describe('Technician My Jobs', () => {
  test('loads with tabs, an assigned job, and a readable detail + checklist', async ({ page }) => {
    const my = new MyJobsPage(page);
    await my.goto();

    // All three view tabs render (not a blank shell).
    await expect(my.tab('Today')).toBeVisible();
    await expect(my.tab('Upcoming')).toBeVisible();
    await expect(my.tab('Completed')).toBeVisible();
    await expect(my.errorState()).toHaveCount(0);

    // The seeded assigned job appears (Today tab is the default view).
    await expect(my.jobCard(JOB_TITLE)).toBeVisible({ timeout: 20_000 });

    // Opening it shows a readable detail sheet with the checklist.
    await my.openJob(JOB_TITLE);
    const sheet = my.sheet();
    await expect(sheet.getByText(JOB_TITLE)).toBeVisible({ timeout: 10_000 });
    await expect(my.backButton()).toBeVisible();
    await expect(sheet.getByText(CHECKLIST_ITEMS[0])).toBeVisible({ timeout: 10_000 });
  });

  test('Completed tab shows a clear empty state, distinct from a load failure', async ({ page }) => {
    const my = new MyJobsPage(page);
    await my.goto();

    await my.selectTab('Completed');

    // A specific, friendly empty message — NOT the error/retry panel, and the
    // seeded (scheduled, not completed) job must not show here.
    await expect(page.getByText(/no completed jobs to show/i)).toBeVisible({ timeout: 10_000 });
    await expect(my.errorState()).toHaveCount(0);
    await expect(page.getByText(JOB_TITLE)).toHaveCount(0);
  });

  test('offline sync indicator is visible app-wide (outside My Jobs) and clears on reconnect', async ({
    page,
    context,
  }) => {
    test.slow();
    const my = new MyJobsPage(page);

    // 1. Prime the offline cache online: the seeded job must be in IndexedDB
    //    before we go offline.
    await my.goto();
    await expect(my.jobCard(JOB_TITLE)).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => (await readIdbStore(page, 'cached_jobs')).some((j) => j.id === jobId), {
        timeout: 20_000,
      })
      .toBe(true);

    // 2. Warm the /my-calendar route chunk while ONLINE via client-side nav, then
    //    return to My Jobs. (Dev mode ships no service worker, so a lazy route not
    //    yet imported cannot be fetched offline — warming it in this same JS
    //    context lets the later offline navigation resolve from memory.)
    //    Technicians can't reach Dashboard/Service Calls (those redirect to
    //    /my-jobs), so /my-calendar is the role-appropriate non-MyJobs page.
    await page.getByTestId('sidebar-nav-my-calendar').click();
    await expect(page).toHaveURL(/\/my-calendar/, { timeout: 15_000 });
    await page.getByTestId('sidebar-nav-my-jobs').click();
    await expect(page).toHaveURL(/\/my-jobs/, { timeout: 15_000 });
    await expect(my.jobCard(JOB_TITLE)).toBeVisible({ timeout: 20_000 });

    // The checklist is cached by a SEPARATE trailing loop (per assigned job)
    // after the jobs list caches — wait for it explicitly, mirroring
    // offline-technician.spec, so the offline checklist render + toggle below is
    // deterministic (not racing the background cache write).
    await expect
      .poll(
        async () =>
          (await readIdbStore(page, 'cached_checklists')).find((c) => c.jobId === jobId)?.items
            ?.length ?? 0,
        { timeout: 20_000 }
      )
      .toBe(CHECKLIST_ITEMS.length);

    // 3. Go offline and queue a technician action (toggle a checklist item).
    await context.setOffline(true);
    await expect(page.getByText('Offline Mode')).toBeVisible({ timeout: 10_000 });
    await my.openJob(JOB_TITLE);
    await expect(my.sheet().getByText(CHECKLIST_ITEMS[0])).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: `Toggle ${CHECKLIST_ITEMS[0]}` }).click();
    await expect
      .poll(async () => (await readIdbStore(page, 'sync_queue')).length, { timeout: 10_000 })
      .toBeGreaterThan(0);

    // 4. Close the sheet and client-side navigate to the warmed non-MyJobs page.
    await my.closeJob();
    await page.getByTestId('sidebar-nav-my-calendar').click();
    await expect(page).toHaveURL(/\/my-calendar/, { timeout: 15_000 });

    // The compact offline-sync indicator (PR-H1) shows in the app header here,
    // outside My Jobs — proving sync state is visible app-wide.
    const indicator = page.getByRole('banner').getByTestId('offline-indicator').first();
    await expect(indicator).toBeVisible({ timeout: 10_000 });

    // 5. Reconnect → the queue drains → the indicator clears on this same page.
    await context.setOffline(false);
    await expect
      .poll(async () => (await readIdbStore(page, 'sync_queue')).length, { timeout: 20_000 })
      .toBe(0);
    await expect(page.getByRole('banner').getByTestId('offline-indicator')).toHaveCount(0, {
      timeout: 15_000,
    });
  });
});
