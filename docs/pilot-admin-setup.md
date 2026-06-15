# Pilot Admin Setup & Pre-Pilot Checklist

How to stand up and run a **controlled 1-company FieldTek pilot** without needing the founder to
walk every step live. Companion docs:
[technician-getting-started.md](technician-getting-started.md) (field-facing),
[pilot-troubleshooting.md](pilot-troubleshooting.md) (support), and
[role-capabilities.md](role-capabilities.md) (who can see what).

> Scope note: "Jobs" is the default label for a work order / service call. The app can relabel it
> per industry (HVAC, Plumbing, etc.) via industry terminology, so a pilot tenant may see "Jobs",
> "Work Orders", "Service Calls", etc. The route is always `/jobs`. This doc uses **Jobs**.

---

## Purpose

Set up a single, supervised tenant so a real field-service company can use FieldTek end to end —
dispatcher creates and assigns jobs, technicians complete them in the field (including offline) —
while the team watches closely and support can resolve issues quickly.

## Recommended pilot shape

| Dimension | Recommendation |
|---|---|
| Companies (tenants) | **1** |
| Admin / dispatcher | **1** (can be the same person — owner role covers both) |
| Technicians | **1–2** |
| Clients | 2–5 real or realistic |
| Jobs | **5–10**, at least some with checklists, spread across a few days |
| Duration | **~1 week** |
| Devices | At least one real iPhone and/or Android for the technician(s) |

Keep it small on purpose: a pilot is about trust and supportability, not scale.

---

## Admin onboarding steps

Do these as the company **owner/admin** account. Each step lists where it lives in the app.

### 1. Tenant / company setup — `/onboarding`
A 4-step wizard (**Company → Industry → Branding → Ready**):
- **Company:** company name.
- **Industry:** pick the closest (HVAC, Plumbing, Electrical, …). This sets sensible defaults
  (job types, workflow stages, terminology).
- **Branding:** optionally set primary/secondary colors.
- **Ready:** finishing creates the tenant and makes you the **owner**, then drops you on `/dashboard`.

### 2. Invite users — `/team` → **Invite Team Member**
- Nav: **Team** (owner/admin only).
- The **Invite Team Member** button opens a dialog: **Email address** + **Role**
  (Admin, Dispatcher, Technician, Client).
- Sending emails an invite link; the member shows as **pending** until they accept and set a password.
- For the pilot: invite 1 admin/dispatcher (if not you) and 1–2 technicians.

### 3. Confirm roles — `/team`
- The Team page lists members with their role, plus stats (Active Members, Pending, Admins,
  Technicians). Confirm each person has the **intended role before** they start — role drives what
  they can see (see [role-capabilities.md](role-capabilities.md)).
- A technician should be **technician**, not admin; a dispatcher who shouldn't manage billing/team
  should be **dispatcher**, not owner/admin.

### 4. Create / verify client records — `/clients` → **Add Client**
- Nav: **Clients** (owner/admin/dispatcher).
- **Add Client** opens a form (name, email, phone, address). You can also bulk-import via CSV.
- Create the handful of clients the pilot jobs will be attached to.

### 5. Create jobs (service calls) — `/jobs` → **New Job**
- Nav: **Jobs** (owner/admin/dispatcher).
- **New Job** opens a form: title, description, **client**, **assigned technician**, job type,
  priority, status, scheduled date/time, estimated duration, address, notes.
- Create 5–10 jobs across a few days.

### 6. Assign technicians — in the **New Job** / job form
- Set **Assigned to** = the pilot technician. Assigning a job sends the technician a push
  notification (if they enabled notifications).
- You can also bulk-assign from the Jobs list.

### 7. Add / verify checklists — `Settings → Checklists` (`/settings?tab=checklists`)
- Nav: **Settings → Checklists** (owner/admin).
- Checklist items are defined per **Workflow Stage × Job Type**. Add the steps a technician should
  complete for the job types you're piloting.
- Checklists auto-attach to a job based on its stage/type, so a job of a configured type shows its
  checklist to the assigned technician.

### 8. Confirm the technician can see assigned jobs — `/my-jobs`
- Have the technician log in (or impersonate / use a test technician) and open **My Jobs**.
- Confirm the assigned job appears under **Today/Upcoming**, opens to a detail view, and shows the
  checklist. If it doesn't, see
  [pilot-troubleshooting.md → "Technician cannot see an assigned job"](pilot-troubleshooting.md).

---

## Pre-pilot readiness checklist

Run this gate **before** inviting the pilot company. Tick every box.

**App / deploy**
- [ ] Latest `main` is deployed (Vercel serving the newest build).
- [ ] CI **and** E2E are green on the deployed commit (GitHub Actions).
- [ ] Service worker is **prompt-mode** live — a new deploy shows a "New version available" toast
      rather than silently reloading (see [technician-getting-started.md](technician-getting-started.md)).
- [ ] App-wide **offline sync badge** is visible app-wide (header shows Offline / Syncing… /
      _N_ pending / Sync error when relevant — not only on My Jobs).
- [ ] **Query errors show a retry state** — a failed Dashboard/Jobs/Schedule/My Jobs load shows a
      "Couldn't load…" panel with **Try again**, not a blank or zeroed screen.
- [ ] **RoleGuard fallback verified** — an authenticated user whose workspace can't load sees the
      "Couldn't load your workspace" recovery card (Try again / Sign out), never a blank page.

**Backend / env (verify only — do not change)**
- [ ] Primary backend is **`fgemfxhwushaiiguqxfe`** (`VITE_SUPABASE_URL` →
      `https://fgemfxhwushaiiguqxfe.supabase.co`). See [RUNBOOK.md §1](RUNBOOK.md).
- [ ] The **7 deferred workflow-template migrations remain intentionally pending** — they are a
      separate work stream and must **not** be applied for the pilot (see [RUNBOOK.md §4](RUNBOOK.md)).
- [ ] Admin → **System Health** is green; invite + checklist-verify edge functions reachable.

**User / account setup**
- [ ] Pilot tenant onboarded (wizard complete); industry preset applied.
- [ ] ≥1 admin/dispatcher and ≥1–2 technicians invited **and accepted** (invite emails received).
- [ ] ≥1 client and 5–10 jobs created; checklists attached where intended.
- [ ] Each technician has **logged in once online** and can see their assigned jobs in My Jobs.

**Technician device readiness**
- [ ] PWA installed on the technician's real device (iPhone via Safari, Android via Chrome) and
      launched **online once** so the service worker + offline cache prime
      (full steps: [technician-getting-started.md](technician-getting-started.md)).
- [ ] Optional but recommended: run the warm + cold-open + sign-out drills in
      [offline-field-drill.md](offline-field-drill.md) on that device.

**Support**
- [ ] A support contact + process is in place (who the company calls/messages, and where it lands).
- [ ] Support has read [pilot-troubleshooting.md](pilot-troubleshooting.md) and knows the
      escalation path and what diagnostic info to collect.

---

## Success criteria for the pilot

The pilot is on track if, over the week:
- A dispatcher can create, assign, and reschedule jobs without help.
- A technician can find their assigned jobs, complete checklist items, save notes, and update job
  status — including at least one **offline** session that **syncs cleanly** on reconnect.
- No technician hits a **blank/unrecoverable screen** (query errors and workspace-load errors both
  show a recovery action).
- Support resolves day-to-day issues from [pilot-troubleshooting.md](pilot-troubleshooting.md)
  without escalating to engineering for routine questions.
- **Zero unexplained data loss.** If an offline change is permanently dropped (after 10 sync
  attempts), the technician sees a loud, persistent warning naming the job — it is never silent.

## Daily pilot monitoring checklist

- [ ] Admin → **System Health** green; no new critical `system_alerts` (see [RUNBOOK.md §5](RUNBOOK.md)).
- [ ] Sentry (if configured) shows no new fatal errors from the pilot tenant.
- [ ] Spot-check: jobs created/assigned that day actually appear in the assigned technician's My Jobs.
- [ ] Ask technicians: did anything fail to save / get stuck "pending" / show a "Sync error"?
- [ ] Review any **support tickets** from the day; fold recurring ones back into the troubleshooting doc.
- [ ] After any deploy mid-pilot: confirm clients picked up the new build (the "New version
      available" prompt) and re-primed offline caches.

## Known limitations to communicate to the pilot company

State these up front so they aren't surprised (details in
[offline-field-drill.md §4](offline-field-drill.md)):
- **iOS has no background sync.** Offline changes upload only while the app is **open/foreground**.
  Habit: back in coverage → open the app → watch the sync badge drain.
- **Last-write-wins.** If a dispatcher and an offline technician edit the same job/checklist, the
  later replay wins; there's no merge screen. Coordinate ownership of in-progress jobs.
- **Long offline periods can expire the login.** After days offline the session may need a fresh
  online login before queued changes sync.
- **Offline change dropped after 10 failed attempts.** Kept and retried up to 10 times; if it still
  can't sync it's removed and the technician gets a persistent warning (contact support if a change
  is missing).
- **Admin/desktop routes are not offline-enabled.** Offline support targets the technician flow
  (`/my-jobs`); `/admin/*` and most desktop admin pages need a connection.
- **First load must be online**, and the app re-primes after each deploy.

## Rollback / safety

Every Workstream H change is additive frontend/docs and reverts per-branch. For an offline/service
-worker emergency, the rollback is to **redeploy the previous frontend bundle on Vercel**; clients
then see the "New version available" prompt and reload into it. There is no database/edge state to
undo for these. Full procedure: [RUNBOOK.md §2–§3](RUNBOOK.md).
