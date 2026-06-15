# Offline Field Drill — Technician PWA

Manual verification drills for technician offline readiness. Run these on real devices before
relying on offline behavior in the field. Covers Workstream E Slice 1 (offline data: IndexedDB
queue + sync replay) and Slice 2 (PWA app shell: cold-open offline).

**Prerequisite for every drill:** a technician account with at least one assigned job (with a
checklist) on the primary backend, and the app loaded **online at least once** after the Slice 2
deploy so the service worker installs and the caches prime.

> **Pilot docs:** this drill is the engineer/operator-facing offline verification. The
> non-technical, field-facing companion is [technician-getting-started.md](technician-getting-started.md);
> pilot setup is in [pilot-admin-setup.md](pilot-admin-setup.md) and support steps are in
> [pilot-troubleshooting.md](pilot-troubleshooting.md).

---

## 1. Install the PWA

### iPhone (Safari)

1. Open the app URL in **Safari** (not Chrome — iOS PWAs install via Safari only).
2. Log in as the technician and wait for My Jobs to load fully.
3. Tap **Share → Add to Home Screen → Add**.
4. Launch from the home-screen icon once while online. This first launch installs the service
   worker and precaches the app shell.

### Android (Chrome)

1. Open the app URL in **Chrome**.
2. Log in as the technician and wait for My Jobs to load fully.
3. Tap the **Install app** prompt (or ⋮ menu → *Add to Home screen / Install app*).
4. Launch from the home-screen icon once while online.

---

## 2. Warm offline drill (app already open, connection drops)

Simulates losing signal mid-shift with the app in hand.

1. Launch the installed PWA **online**. Open **My Jobs** and tap into the assigned job once
   (this primes the IndexedDB cache: jobs, client, checklist).
2. Enable **Airplane Mode**. The offline banner should appear.
3. Open the job from the list (it should render from cache).
4. **Update status** (e.g. Start Job → In Progress). Expect a "Saved offline" toast.
5. **Complete checklist items** — toggle at least two items. Each shows "Saved offline. Will
   sync when connected." and the checkbox state sticks.
6. **Save a note** on a checklist item.
7. **Capture evidence/photo** on a step that requires it. The photo is stored locally
   (IndexedDB blob) and queues for upload.
8. Disable Airplane Mode and **keep the app in the foreground**.
9. Watch the pending-sync indicator drain (or tap the manual **Sync** button).
10. **Verify on a second device/desktop** (dispatcher view): job status, checklist completions
    (with the technician recorded as completer), note text, and evidence all arrived.

**Pass:** every offline change replays to the server without duplicates or losses.

---

## 3. Cold-open drill (launch the app from scratch while offline)

Simulates starting the day in a basement/remote site with no signal. This is the Slice 2 behavior.

1. Launch the installed PWA **online** once; open My Jobs and a job (primes shell + data caches).
2. **Force-quit** the PWA (iOS: swipe up and away in the app switcher; Android: swipe away in
   recents).
3. Enable **Airplane Mode**.
4. Launch the PWA **from the home-screen icon**.
5. **Verify the shell renders** — not a browser error page, not a blank white screen. You should
   land on My Jobs (the app redirects technicians there) with the offline banner visible.
6. **Verify cached data renders** — the assigned jobs list and, on opening a job, its checklist.
7. Make offline changes (toggle a checklist item, save a note, update status).
8. Disable Airplane Mode, keep the app foregrounded, and let sync drain (or tap Sync).
9. Verify the changes on a second device/desktop as in the warm drill.

**Pass:** the app opens to a usable My Jobs screen with cached data while fully offline, and the
changes sync on reconnect.

---

## 3a. Shared-device sign-out drill (no data leaks to the next user)

Simulates one shared phone/tablet passed between technicians. Sign-out clears all FieldTek-owned
offline data (IndexedDB caches/queues/evidence + the per-user tenant snapshot).

1. Log in **online** as technician A. Open **My Jobs** and a job so the offline cache + tenant
   snapshot prime (DevTools → Application → IndexedDB `fieldtek-offline` has rows; Local Storage
   has a `fieldtek-tenant-snapshot:<A's user id>` key).
2. **Sync any pending offline changes first** — sign-out intentionally discards the offline queue.
3. Tap **Sign Out**.
4. Confirm cleanup: DevTools → Application → IndexedDB `fieldtek-offline` stores
   (`cached_jobs`, `cached_clients`, `cached_checklists`, `sync_queue`, `offline_metadata`,
   `evidence_blobs`) are **empty**, and **no** `fieldtek-tenant-snapshot:` key remains in Local
   Storage. (The Supabase session keys and unrelated prefs are untouched.)
5. Log in as technician B (or relaunch offline): technician A's jobs/checklists must **not** render.

**Pass:** after A signs out, none of A's cached jobs, checklists, queued ops, evidence, or tenant
snapshot are visible to B. **Note:** sign-out is best-effort cleanup and is *not* a substitute for
syncing — unsynced offline work is discarded on sign-out by design.

---

## 4. Known limitations

- **iOS has no Background Sync.** Replay only happens while the app is in the **foreground** —
  technicians must reopen (or keep open) the app after regaining signal for queued changes to
  upload. Train the habit: *back in coverage → open the app, watch the sync indicator drain.*
- **Last-write-wins conflicts.** If a dispatcher edits the same job/checklist while the
  technician is offline, the technician's replayed change overwrites it (and vice-versa, by
  timing). No merge UI exists; coordinate ownership of in-progress jobs.
- **Auth token expiry after long offline periods.** The Supabase access token expires (~1 hour).
  The client refreshes it on reconnect, but after very long offline stretches (days) the refresh
  token may be invalid — sync will fail with auth errors until the technician logs in again.
  Queued changes are kept (up to the retry cap) but won't replay until auth succeeds online.
- **Photo/quota risk.** Evidence photos queue as IndexedDB blobs. Many large photos while
  offline can hit browser storage quotas (especially iOS); the device may evict data under
  pressure. Sync soon and avoid multi-day offline photo backlogs.
- **Two-tab duplicate replay risk.** Two open tabs (or PWA + browser tab) can both drain the
  sync queue on reconnect and race each other. Replayed operations are mostly idempotent
  updates, but keep one instance open in the field.
- **First load must be online.** Nothing renders offline on a device that has never loaded the
  app (no service worker, no caches). The shell also re-primes after a deploy — open the app
  online after releases.
- **Admin/desktop routes are not offline-enabled.** The offline shell targets technician flows
  (`/my-jobs`); `/admin/*` is deliberately excluded from the offline navigation fallback.

---

## 5. If something looks wrong

- Hard-refresh while online (pull-to-refresh or browser reload) to pick up the newest build.
- Check pending items: the sync indicator on My Jobs shows the queue depth.
- Worst case: browser settings → clear site data, then log in online and re-prime. (This drops
  any **unsynced** offline changes — sync first if at all possible.)
- Operators: the PWA is **prompt-mode** (`registerType: "prompt"`), so emergency rollback is to
  redeploy the previous frontend bundle on Vercel — clients then accept the "New version available"
  prompt and reload into it. (A `selfDestroying` service-worker kill switch was discussed in the
  Slice 2 handoff but is **not** wired into `vite.config.ts`; treat rollback as redeploy + reload.)
  See [RUNBOOK.md §2–§3](RUNBOOK.md) and [pilot-troubleshooting.md §10](pilot-troubleshooting.md).
