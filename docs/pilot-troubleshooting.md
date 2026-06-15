# Pilot Troubleshooting Guide (Support)

Support-friendly fixes for the most common pilot issues. Each item has **symptoms → first checks →
fix → escalate if**. Start at the top; most issues resolve in the first one or two steps.

Related docs: [pilot-admin-setup.md](pilot-admin-setup.md),
[technician-getting-started.md](technician-getting-started.md),
[role-capabilities.md](role-capabilities.md), [offline-field-drill.md](offline-field-drill.md),
[RUNBOOK.md](RUNBOOK.md).

> **Never share secrets.** Do not paste service-role keys, API keys, or vault secrets into tickets
> or chats. The Supabase **project ref `fgemfxhwushaiiguqxfe`** is public and fine to mention; keys
> are not. The diagnostics in the last section are all non-sensitive.

---

## Diagnostic info to collect first (every ticket)

> **Fastest path — the in-app Diagnostics panel.** Have the user open the menu (the sidebar on
> desktop, or the **☰** menu on mobile), tap **Diagnostics**, then **Copy diagnostics**, and paste
> the result to you. One paste gives you app version, build mode, route, backend ref, online/offline,
> service-worker + PWA status, pending sync count, sync errors, last sync, company, and account — all
> the fields below, with **no secrets**. It's read-only and available to **every** signed-in user
> (technicians included).

Ask for / record these — they answer most questions on their own (the Diagnostics panel covers most):

- **User email** (who is affected)
- **Tenant / company name**
- **App version / build mode** — read straight from **Diagnostics → Copy diagnostics** (above).
  (Fallback without the panel: in a desktop browser read the `data-app-version` attribute on the
  `<html>` tag, or the console `[FieldTek] build …` line. If unsure, have them reload for the newest
  build.)
- **Page / route** they were on (e.g. `/my-jobs`, `/jobs`, `/dashboard`)
- **Online or offline** at the time
- **Pending sync count** (the badge number on My Jobs), and whether it said **Sync error**
- **Screenshot of the error message** (most valuable single item)
- **Approximate time** it happened (for matching logs/alerts)
- **Job name / ID** if a specific job is involved

---

## 1. Invite email not received

**Symptoms:** a new user never got the invite link.
**First checks:**
- Confirm the **exact email** on `/team` matches what they're checking; look in **spam/junk**.
- On `/team`, the user should show as **pending**.
**Fix:**
- Re-send the invite from `/team` (re-invite the same email).
- Have them search their mailbox for the sender domain.
**Escalate if:** repeated sends never arrive for a valid address → engineering (email delivery /
`send-team-invitation` edge function; see [RUNBOOK.md §6](RUNBOOK.md) for the email provider).

## 2. User can log in but sees "Couldn't load your workspace"

**Symptoms:** after login they get a card titled **"Couldn't load your workspace"** with **Try
again** and **Sign out** (not a blank screen — that's the intended recovery card).
**What it means:** they're authenticated, but FieldTek couldn't confirm their workspace/role
(e.g. their team membership isn't active yet, a transient network/permission hiccup, or they
accepted the invite on a different account/email).
**First checks / fix:**
1. Tap **Try again** — transient cases clear immediately.
2. Confirm on `/team` the user is **active** (not still pending) and is a member of the **correct
   tenant**.
3. Confirm they logged in with the **same email** the invite was sent to (not a personal alias).
4. If still stuck, **Sign out** and sign back in once online.
**Escalate if:** an active, correctly-invited member still can't load after retrying → engineering
(tenant membership / RLS).

## 3. Wrong role, or can't see expected pages

**Symptoms:** a user is missing menu items (e.g. a technician has no Jobs/Team; a dispatcher has no
Settings), or gets redirected away from a page.
**What it means:** menus and pages are filtered by **role** — this is by design. See the exact
matrix in [role-capabilities.md](role-capabilities.md).
**First checks / fix:**
- On `/team`, confirm the user's **role** is what you intend (technician vs dispatcher vs admin/owner).
- If wrong, change it; the user may need to **reload** (or sign out/in) to pick up the new menus.
- Technicians correctly see **My Jobs / My Calendar** (not the dispatcher Jobs/Schedule); that's not
  a bug.
**Escalate if:** the role is correct but pages still don't match the matrix → engineering.

## 4. Technician cannot see an assigned job

**Symptoms:** dispatcher assigned a job but it's not in the technician's **My Jobs**.
**First checks / fix:**
1. On `/jobs`, open the job and confirm **Assigned to** is **that** technician (exact person).
2. Confirm the **scheduled date** — My Jobs groups into **Today / Upcoming / Completed**; check the
   right tab.
3. Have the technician **pull-to-refresh** My Jobs (or reload) while online.
4. If they're offline, the job only appears if it was cached on a previous online open — get them
   online once.
**Escalate if:** assignment is correct, online, refreshed, and it still doesn't appear → engineering.

## 5. App looks stale / old after a deploy

**Symptoms:** new feature/fix isn't showing; UI looks like the previous version.
**What it means:** FieldTek uses a **prompt-mode** service worker — a new version doesn't force
itself on an open app; it offers a **"New version available"** prompt.
**First checks / fix:**
1. Look for the **"New version available"** toast → tap **Reload**. (If they have pending changes
   it warns first; sync to 0, then reload. If offline, reconnect first.)
2. No prompt? **Reload** the page / relaunch the installed app while **online**.
3. Still stale → see **§10 service-worker / cache recovery**.
**Escalate if:** a confirmed-deployed change won't appear after a clean reload + cache clear →
engineering (verify the deploy actually shipped; [RUNBOOK.md §2](RUNBOOK.md)).

## 6. PWA won't install

**Symptoms:** no install option / "Add to Home Screen" missing.
**First checks / fix:**
- **iPhone:** must use **Safari** (Chrome on iOS can't install it). Use **Share → Add to Home
  Screen**. (Full steps: [technician-getting-started.md §2](technician-getting-started.md).)
- **Android:** use **Chrome**; look for the **Install app** prompt or **⋮ → Install app**.
- Make sure they opened the **real app URL** over **https**, fully loaded, while **online**.
**Escalate if:** correct browser + URL, online, and still no install option → engineering.

## 7. Offline changes pending for a long time

**Symptoms:** the **_N_ pending** badge won't drop to 0.
**What it means:** changes are saved on the phone but haven't uploaded. On iPhone, upload happens
only while the **app is open**.
**First checks / fix:**
1. Confirm real internet (open any website).
2. **Open FieldTek and keep it in the foreground** for a minute; watch the badge drain.
3. Tap the **Sync** button on the My Jobs status panel if shown.
4. Avoid having FieldTek open in **two tabs/windows** at once.
**Escalate if:** online, app open and foregrounded, and the count won't move → engineering (capture
the pending count + any Sync error text).

## 8. "Offline change could not sync" / dropped after 10 attempts

**Symptoms:** a **persistent red** message **"Offline change could not sync"** naming a job, saying
a change "failed after 10 attempts and was removed."
**What it means:** FieldTek retried that one change 10 times and couldn't send it, so it removed it
from the queue (this is by design, so a single bad change can't block everything). It is **loud on
purpose** — it is never silent.
**First checks / fix:**
1. Have the technician note the **job name** in the message (and screenshot it), then **Dismiss**.
2. On `/jobs`, **check that job** — re-enter the change if it's missing (e.g. re-toggle the checklist
   item, re-save the note, re-set the status) while **online**.
3. Note the time and job so engineering can correlate if it recurs.
**Escalate if:** drops repeat for the same user/job, or a customer-critical change was lost →
engineering (include user email, job name/ID, time).

## 9. Dashboard / Jobs / Schedule shows "Couldn't load…"

**Symptoms:** a page shows a **"Couldn't load…"** panel with a **Try again** button (instead of a
blank or all-zero screen).
**What it means:** that data fetch failed — usually a temporary connection/permission blip.
**First checks / fix:**
1. Tap **Try again** on the panel.
2. Check internet; reload the page.
3. On My Jobs offline, the message will say it's an offline/cache situation — get online and retry.
**Escalate if:** **Try again** keeps failing while clearly online → engineering (note the page and
time; correlate with Admin → System Health / [RUNBOOK.md §5](RUNBOOK.md)).

## 10. Service-worker / cache recovery steps

Use when the app is stale, stuck, or behaving oddly after a deploy. **Sync pending changes first if
at all possible — clearing data drops unsynced offline work.**

1. **Reload online** (pull-to-refresh or browser reload) to pick up the newest build / accept the
   "New version available" prompt.
2. **Fully close and reopen** the installed app (swipe it away in the app switcher, relaunch).
3. **Clear site data** (last resort): browser settings → site settings for the FieldTek URL →
   **Clear data** → reopen and log in **online** to re-prime. This removes cached jobs and any
   **unsynced** changes.
4. **Operator-level:** for a bad release affecting everyone, the rollback is to **redeploy the
   previous frontend bundle on Vercel**; clients then get the "New version available" prompt and
   reload into the previous version. There is no automated client kill-switch — see
   [RUNBOOK.md §2–§3](RUNBOOK.md) and the rollback notes in
   [offline-field-drill.md §5](offline-field-drill.md).

---

## When to escalate to engineering

Escalate when, after the steps above:
- An **active, correctly-roled** user still can't load their workspace or see correct pages.
- A **correctly-assigned** job never appears for an online, refreshed technician.
- **Offline changes repeatedly drop**, or a customer-critical change was lost.
- A **confirmed-deployed** change won't appear after a clean reload + cache clear.
- **Sign-in/invite** fails for a valid address after re-sends.
- Anything that looks like **data loss, a security/permission problem, or an outage** (also check
  Admin → **System Health** and Sentry — [RUNBOOK.md §5/§7](RUNBOOK.md)).

**Include in the escalation:** the **Diagnostics → Copy diagnostics** paste (covers app version,
route, backend ref, online/offline, pending count, last sync, company, account, support session) plus
a **screenshot**, the **time** it happened, and the **job name/ID**. Do **not** include secrets or
keys — the diagnostics paste is already secret-free by design.
