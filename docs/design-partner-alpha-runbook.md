# Design Partner Alpha Runbook

How to select, pitch, onboard, and run FieldTek's **first founder-guided design
partners**. This layers the *engagement* side on top of the mechanical
[pilot-onboarding-runbook.md](./pilot-onboarding-runbook.md) — read that first;
this document does not repeat its preflight, smoke checklist, or teardown steps.

Alpha context (2026-07): the website (www.fieldtek.ai) carries honest
Today/Coming claims, /privacy and /terms are live, cross-tenant guards are
deployed (field-assistant v32), and **Stripe Live is deliberately paused** — the
alpha runs entirely on the 30-day in-app trial with **no payment collected**.

---

## 1. First-partner selection criteria

The first partner shapes the learning loop's seed data and the first citable
lessons. Choose for *fit and feedback quality*, not logo value.

### Must-haves (all required)

| # | Criterion | Why |
|---|---|---|
| 1 | **HVAC** (or HVAC-heavy mechanical) | Equipment-graph and compliance seeds, the diagnostic wizard, and eval coverage are HVAC-centric today. Other trades get a worse product and generate feedback we can't act on yet. |
| 2 | **Owns real documentation** — PDF manuals, spec sheets, internal SOPs they can legally upload | Sentinel's value is grounded answers with citations *from their docs*. No docs → generic answers → the demo disproves itself. |
| 3 | **2–15 field staff** | Big enough to exercise roles (owner/dispatcher/technician), small enough for founder-guided support and trial-tier limits. |
| 4 | **Owner commits to a weekly 30-min feedback call** for the first 4–6 weeks | This is a design partnership, not a free trial. No call commitment → not a design partner. |
| 5 | **Beta-tolerant** — explicitly accepts bugs, changes, and occasional downtime (mirrors /terms beta clause) | Prevents the relationship from souring on the first rough edge. |
| 6 | **Techs carry smartphones** and will actually use them on jobs | Field usage (assistant queries, checklists, offline) is where the learning data comes from. |

### Strong-fit signals (prefer partners with 2+)

- A senior "knowledge keeper" tech whose expertise the owner wants captured
  (directly motivates the citable-lessons loop).
- Existing pain in dispatch/scheduling or job history ("what did we do at this
  site last time?").
- Came via referral / existing trust relationship with the founder.
- Willing to be quoted or referenced later (not required now).

### Disqualifiers (any one)

- **Core need is customer payments or quotes/e-signatures** — online invoice
  payment is not wired during the alpha (Stripe paused) and quote approval /
  digital signatures are unbuilt. Don't onboard someone whose main problem we
  can't touch.
- **Needs compliance guarantees** — Sentinel gives code-aware *guidance*; /terms
  explicitly defers to the AHJ and licensed professional judgment. A partner who
  wants "the app said it was to code" is a liability, not a partner.
- **Hard SLA / uptime requirements** — beta terms are as-is.
- **Multi-branch / enterprise** — out of alpha scope end to end.
- Wants a discount *negotiation* now — pricing is already promised: founding
  members get 50% off their first year when payments start (`is_beta_founder`,
  coupon `WQMyNyRo`). Nothing to negotiate during a free alpha.

---

## 2. The honest pitch (what to say to the partner)

Stay inside the live website claims — the partner will read the site. The safe
framing, in the founder's voice:

> "FieldTek runs your jobs, clients, equipment records, and invoices today, and
> it has an AI assistant — Sentinel — that answers your techs' questions from
> *your* uploaded manuals with page-level citations, and says 'I don't know'
> instead of guessing when your docs don't cover it. The intelligence features
> on our roadmap — pattern recognition, compliance alerts, auto-reports — are
> exactly what we want to build **with** you: your feedback decides what ships.
> You get 30 days free, no card, direct line to me, and founding members lock in
> 50% off their first year whenever you decide it's worth paying for. Your data
> stays yours and is never used to train shared models."

**Never say:** "verified against manufacturer specs", "compliance alerts",
"learns from every job" (present tense), "quote approval/digital signatures",
"auto-generated service reports", "exportable audit trails". These were removed
from the site (PR-COPY-1) because they aren't true yet.

**Answer honestly when asked:**

| Partner asks | Honest answer |
|---|---|
| "Does it check code compliance?" | "It gives code-aware guidance from your docs; it does not replace your AHJ or your judgment, and we say so in our terms. A real compliance-rules engine is on the roadmap and you'd shape it." |
| "Does the AI learn from our jobs?" | "It captures structured data from completed jobs from day one. Turning that into automatic suggestions is gated behind human review — nothing your techs see is machine-invented without approval." |
| "Is our data used for other companies?" | "No. Tenant data is isolated, never used to train shared models, and any future cross-company insights would be opt-in and anonymized — that's in our privacy policy." |
| "Can customers pay invoices online?" | "Not during the alpha — invoicing and PDF generation work, online payment is coming when we switch billing on." |
| "What does it cost?" | "Nothing for 30 days, no card. When payments start, founding members get 50% off the first year — that's already set up under your account." |

---

## 3. Onboarding script (founder-guided, ~60–90 min call)

**Before the call (founder):**

1. Run the full [pilot-onboarding-runbook.md](./pilot-onboarding-runbook.md)
   §1 preflight + confirm no CI E2E run is active on `fgem`.
2. Ask the partner to email 2–3 of their most-used equipment manuals (PDF)
   ahead of the call, so the first Sentinel answer is about *their* equipment.
   Prefer native-text PDFs and screen them before the call — see the §7.1
   document intake policy (scanned binders are deferred, not uploaded day 1).
3. Have the §4 tier/policy SQL and §5 flag SQL ready but **do not run either
   before the tenant exists**.

**On the call (partner drives, founder navigates):**

1. **Register + onboard** — partner signs up (their real email), completes
   `/onboarding` (company → industry: HVAC → branding → launch). Confirm
   `/dashboard` loads clean.
2. **Seed reality** — create their first real client and one real upcoming job
   (not "Test Job" — real data makes every later screen convincing).
3. **Upload the manuals** — `/documents`, upload the PDFs they sent. Narrate
   honestly: "indexing takes a few minutes; the assistant will warn you until
   it's done."
4. **First Sentinel moment** — once embedding completes, have *the partner* ask
   a question they know the answer to from those manuals. The goal is a cited
   answer they can verify — that's the product thesis in one interaction. Also
   deliberately ask one question the docs *don't* cover, so they see the honest
   "I don't know" instead of a guess.
5. **Invite one technician** — `/team` → invite; tech accepts on their phone,
   lands on `/my-jobs`.
6. **Set expectations** — weekly call slot, how to report issues (direct
   channel to founder), what "Coming" features they influence, the 30-day trial
   and what happens after (founder extends it manually if the partnership is
   working — no card, no auto-charge; billing is off).

**After the call (founder, same day):** run §4 + §5 day-1 ops, then §6
monitoring.

---

## 4. Trial, tier, and AI-limit decisions (day 1)

Facts as deployed:

- New tenants get `subscription_tier='trial'`, `trial_ends_at = now() + 30 days`
  (DB default; migration `20260208151124`).
- Sentinel AI is limited **per tenant per UTC day** by tier
  (`TIER_DAILY_LIMITS`, field-assistant): trial **10**, starter 25, growth 50,
  professional 200, **enterprise uncapped** (no entry = no limit check). Ten
  queries/day is too tight for a whole crew genuinely testing the assistant.
  Abstains, blocked responses, and refusals **count against the cap** (the
  limiter counts `ai_audit_logs` rows with no status filter).
- `tenant_ai_policies` provides two per-tenant controls the tier cap doesn't:
  `max_monthly_requests` (hard monthly ceiling, 429 on breach, counted from the
  1st UTC) and `ai_enabled` (master kill switch — `false` returns 403
  immediately). One row per tenant, service-role managed.
- `expire-stale-trials` (cron) flips expired trials to `cancelled`, and DB
  triggers then block new jobs/technicians. An expired design partner mid-alpha
  would be a bad surprise.

**Tier ladder for design partners:**

- **Day 1: `growth` (50 questions/day).** Enough headroom for a 2–15-tech crew
  asking real questions (~20–30/day in practice) without inviting spam, and it
  satisfies the Sentinel AI feature gate.
- **Escalation: `professional` (200/day)** — only after productive usage is
  proven (see §7.2 for the productive-vs-toy test). Not the day-1 default.
- **Never `enterprise`** for a design partner: enterprise has no entry in
  `TIER_DAILY_LIMITS`, which means **no daily cap at all**.

**Recommended day-1 posture** (each a deliberate founder action, run with the
service role after the tenant exists — the SQL below is documentation of a
future founder-approved step, never executed by the PR that added it):

```sql
-- 1. Founding-member status (drives the 50%-off coupon when billing starts;
--    costs nothing now)
update public.tenants set is_beta_founder = true where id = '<tenant_uuid>';

-- 2. Lift the AI daily cap to growth (50/day/tenant) — day-1 default
update public.tenants set subscription_tier = 'growth' where id = '<tenant_uuid>';

-- 3. Monthly ceiling + AI enabled (first partner: 1000/month backstop)
insert into public.tenant_ai_policies (tenant_id, ai_enabled, max_monthly_requests)
values ('<tenant_uuid>', true, 1000)
on conflict (tenant_id) do update
  set ai_enabled = true, max_monthly_requests = 1000;

-- 4. (When the trial nears expiry and the partnership is working) extend it:
update public.tenants set trial_ends_at = now() + interval '30 days' where id = '<tenant_uuid>';
```

**Emergency kill switch** (runaway usage, abuse, or anything that needs an
immediate stop while you talk to the partner):

```sql
update public.tenant_ai_policies set ai_enabled = false where tenant_id = '<tenant_uuid>';
-- Assistant returns 403 "AI assistant is disabled for your organization" on the
-- next request. Reverse with ai_enabled = true when resolved.
```

> **Gotcha — how the manual tier bump interacts with Stripe reconciliation:**
> `check-subscription` reconciles the DB tier against Stripe on every
> billing-page load. Today it throws immediately on `fgem` (no
> `STRIPE_SECRET_KEY` set), so the manual tier always survives. Once Stripe
> secrets are set on `fgem` (sandbox verification or Live flip):
>
> - **No Stripe customer exists for the owner's email** → `check-subscription`
>   returns early and never touches the DB — the manual tier bump survives.
> - **A Stripe customer exists for that email but has no active subscription**
>   (e.g. an earlier checkout test, or an email collision) → reconciliation
>   runs and rewrites the tenant back to `trial`/`trial`, wiping the bump.
>
> Either way the operational advice stands: **re-check every design-partner
> tenant's tier and status as part of any future Stripe wiring step** (also
> noted in the Stripe Live readiness plan).

> **Trial expiry is a separate risk the tier bump does NOT cover:**
> `expire_stale_trials` (cron) flips any tenant with
> `subscription_status = 'trial'` and `trial_ends_at < now()` to `canceled` —
> it keys on **status**, not tier, so a growth- (or professional-) tier bump
> with status still `trial` expires like any other trial. The only protections are
> extending `trial_ends_at` (step 4 above) or deliberately changing the
> trial/status state. Any extension is a deliberate founder action — record
> the date, the new expiry, and the reason in the partner's notes.

---

## 5. Day-1 feature-flag plan

Baseline: the [pilot-onboarding-runbook.md](./pilot-onboarding-runbook.md) §3
posture table applies. Design partners additionally get the **learning loop's
collection side** turned on from day 1 (per the approved claim-to-capability
roadmap), so weeks of real data accumulate before any generative feature ships.

| Flag | Design-partner posture | Notes |
|---|---|---|
| `lesson_citations` | **ON via tenant allowlist** | Read-side of the approved-lessons loop. Only founder-approved, published lessons are ever cited; an empty lesson library simply means no lesson citations yet. |
| `workflow_intelligence` | **ON via tenant allowlist** | Collection only (`collect-workflow-intelligence` on job completion). No prompt influence — pure data capture for the future loop. |
| `workflow_pattern_discovery` | **OFF — do not enable** | `suggest-workflow-patterns` still writes clusters straight to `status='active'` with **no approval gate** (PR-PATTERN-GATE not yet built). Enabling this puts machine-generated patterns into prompts unreviewed. |
| `rag_judge` / `judge_blocking_mode` / `judge_full_blocking` | **OFF — Decision A** | Held eval-only. Do not add any real tenant. |
| `compliance_engine`, `equipment_graph`, `diagnostic_learning`, `rag_reranking` | OFF | Only by explicit later decision, one at a time, after the partner's data supports it. |

Allowlist SQL (same mechanism as the pilot runbook):

```sql
update public.feature_flags
set allowed_tenant_ids = array_append(coalesce(allowed_tenant_ids, '{}'), '<tenant_uuid>')
where key in ('lesson_citations', 'workflow_intelligence');
```

**Verify afterwards — know what the tooling can and cannot show:**

- `npm run verify:pilot -- --tenant-id <tenant_uuid>` reports judge flags
  (expect OFF) and `lesson_citations` — which it will show as **drift**
  against its "do not widen" expectation. For the approved design-partner
  tenant, and only after explicit founder approval, that drift is **expected
  and intentional**; any lesson_citations drift on any *other* tenant is a
  stop-and-investigate.
- `workflow_intelligence` is **not reported by verify:pilot** at all. Verify it
  directly — allowlist inspection:

  ```sql
  select key, allowed_tenant_ids from public.feature_flags
  where key = 'workflow_intelligence';
  ```

  and behaviorally: `workflow_intelligence_edges` rows accrue for the tenant
  after their first completed job (also a §6 monitoring item).
- Follow-up (separate code PR): update `PILOT_RELEVANT_FLAGS` in
  `scripts/lib/pilotReadiness.ts` so the `lesson_citations` note reflects the
  design-partner allowlist decision once it executes.

---

## 6. Monitoring checklist

**Daily, first week** (then weekly):

- [ ] `/admin/ai-audit` filtered to the partner tenant: query volume, any
      `response_blocked=true`, abstain rate (some abstains are healthy —
      zero abstains with thin docs is the suspicious signal). Under Decision A
      rows show `unjudged_no_verdict` — correct, not a defect.
- [ ] Document pipeline: any partner doc stuck outside
      `embedding_status='completed'` → follow
      [pilot-troubleshooting.md](./pilot-troubleshooting.md).
- [ ] AI daily usage vs. cap: `ai_audit_logs` count for the tenant today vs.
      their tier limit (§7.3 query 1) — if they hit the cap, that's *usually* a
      good problem; classify productive vs. toy usage first (§7.2), then raise
      deliberately (§4). Don't let them discover a silent 429.
- [ ] Run the §7.3 read-only SQL set and skim the §7.4 dashboards; act on any
      §7.6 threshold breach the same day.
- [ ] `/admin/system-health`: no unresolved critical alerts.
- [ ] `workflow_intelligence` capture is actually accruing once jobs complete
      (`workflow_intelligence_edges` rows for the tenant) — silence after
      completed jobs means the flag or the completion path needs a look.

**Weekly (before each partner call):** work through the §7.5 weekly review
template, plus:

- [ ] Skim the tenant's assistant questions in `/admin/ai-audit` — the
      questions techs actually ask are the roadmap input; bring 2–3 to the call.
- [ ] Candidate lessons: recurring question themes → draft a lesson → founder
      review → `promote-lesson` (the approval gate is the product; never skip it).
- [ ] Feedback log: `ai_response_feedback` has **no UI yet** (PR-FB-1 pending),
      so thumbs-up/down style feedback must be captured manually in call notes.
- [ ] Trial clock: days remaining on `trial_ends_at`; extend (§4) *before* it
      lapses, never after.
- [ ] No E2E/eval collision risk: partner tenants use real identities, so the
      standing rule from the pilot runbook (never reuse fixture names/emails)
      keeps them safe from CI teardown — re-confirm nobody onboarded a partner
      with a `*@fieldtek-test.dev` address.

---

## 7. Cost and usage guardrails

Why this section exists: per-question AI cost is pennies (one
`text-embedding-3-small` call + one `gpt-4.1-mini` answer — even 200
questions/day is roughly $1–2/day worst case). The two real cost/usage risks
are **scanned-document ingestion** and **nobody looking**. Everything below is
policy and read-only checks; the enforcement mechanisms (tier caps, monthly
ceiling, kill switch) are already deployed and configured per §4.

### 7.1 Document intake policy

- **Start with 2–3 real manuals**, founder-assisted upload on the onboarding
  call. No bulk library imports, no "upload everything" — and **no scanned
  binders at onboarding**.
- **Why scans are the cost risk:** text-layer PDFs extract locally (unpdf) at
  zero API cost. A scanned/image-only PDF falls back to vision extraction that
  sends the **entire file** to `gpt-4.1-mini` with no page cap — one fat
  scanned binder can cost more than a month of AI questions, and extraction
  quality is worse. The 10-second screen: open the PDF, try to select text.
  Text selects → fine. Nothing selects → defer it; if a scanned manual is
  essential, split it or find the manufacturer's digital original first.
- Per-file bounds already enforced: 50MB/file (storage bucket), 100K extracted
  chars/doc, 500 chunks/doc. A doc that hits the char/chunk cap is silently
  truncated for retrieval — check `documents.ingestion_warnings` after every
  upload and tell the partner honestly if a manual was truncated.
- **Expansion gate — approve more documents only when ALL of these hold:**
  1. Every current doc is fully indexed: `extraction_status='completed'` AND
     `embedding_status='completed'`, zero failed/stuck (§7.3 query 5).
  2. Real abstains point at genuinely missing coverage — abstained questions
     the new doc would actually answer.
  3. Existing docs are being cited (`had_citations` on answered rows), so more
     docs add value rather than noise.
  4. Chunk and storage footprint are inside the §7.6 thresholds.

  Then expand in **small batches (~5 docs)**, re-checking the gate after each
  batch. Never bulk-upload a full historical library during the alpha.

### 7.2 AI usage policy

- **Start:** growth tier = 50 questions/day + `max_monthly_requests = 1000`
  (§4). Note that **abstains and blocked responses count against the cap** — a
  partner with thin docs can burn quota on honest "I don't know"s. That is a
  document-coverage signal, not a reason to raise the cap.
- **Cap hits are not outages.** The user sees a clear 429 message with the
  reset time (next UTC midnight). Same day, review `/admin/ai-audit` for the
  tenant and classify before touching any limit:
  - **Productive usage** — multiple distinct users asking; varied questions
    tied to real jobs/equipment; healthy citation rate; abstains followed by
    doc uploads. → Raise deliberately: `professional` (200/day) +
    `max_monthly_requests = 3000`. Record the change and reason in the
    partner's notes.
  - **Toy/abuse usage** — repeated identical questions; one user generating
    almost all volume; test-style prompts ("hello", "what can you do")
    dominating; questions unrelated to their trade. → Coach on the weekly
    call; do **not** raise the cap. If it persists, lower
    `max_monthly_requests`; if it's runaway or abusive, flip
    `ai_enabled = false` (§4 kill switch) and talk to the partner.
- Every raise/lower is a deliberate founder action, recorded per tenant.

### 7.3 Daily monitoring SQL (read-only)

Run in the Supabase SQL editor (fgem, session TZ is UTC), substituting the
partner's tenant id for `<tenant_uuid>`. Daily for the first two weeks, then
3×/week. All queries are read-only.

```sql
-- 1. Questions today vs. the daily cap (mirrors the limiter's own count)
select count(*) as used_today
from ai_audit_logs
where tenant_id = '<tenant_uuid>'
  and created_at >= date_trunc('day', now() at time zone 'utc');

-- 2. Month-to-date vs. max_monthly_requests + estimated tokens
--    (token counts are char/4 estimates, not billed usage — real $ lives in
--    the OpenAI dashboard, §7.4)
select count(*) as used_month,
       sum(coalesce(token_count_prompt, 0) + coalesce(token_count_response, 0)) as est_tokens
from ai_audit_logs
where tenant_id = '<tenant_uuid>'
  and created_at >= date_trunc('month', now() at time zone 'utc');

-- 3. Outcome mix today (quality + toy-usage signal)
select response_blocked, refusal_flag, had_citations,
       count(*) as row_count, count(distinct user_id) as distinct_users
from ai_audit_logs
where tenant_id = '<tenant_uuid>'
  and created_at >= date_trunc('day', now() at time zone 'utc')
group by 1, 2, 3;

-- 4. Repeated identical questions today (toy/loop detector)
select user_message, count(*)
from ai_audit_logs
where tenant_id = '<tenant_uuid>'
  and created_at >= date_trunc('day', now() at time zone 'utc')
group by 1 having count(*) >= 5;

-- 5. Document pipeline health (anything returned here needs eyes)
select id, name, extraction_status, embedding_status,
       retry_count, last_error, ingestion_warnings
from documents
where tenant_id = '<tenant_uuid>'
  and (extraction_status <> 'completed' or embedding_status <> 'completed');

-- 6. Chunk + storage footprint
select (select count(*) from document_chunks where tenant_id = '<tenant_uuid>') as chunks,
       (select coalesce(sum(file_size), 0) from documents where tenant_id = '<tenant_uuid>') as bytes_used;

-- 7. Unresolved platform alerts
select created_at, severity, alert_type, message
from system_alerts
where resolved_at is null
order by created_at desc
limit 20;
```

### 7.4 Dashboard checklist

- [ ] `/admin/ai-audit` — skim the day's questions and outcome badges.
- [ ] `/admin/rag-quality` — abstain/blocked/similarity trend (30-day window).
- [ ] `/admin/system-health` — no unresolved critical alerts.
- [ ] Supabase dashboard → Edge Functions logs for `field-assistant`,
      `extract-document-text`, `generate-embeddings` — non-2xx spikes.
- [ ] Supabase project usage page — DB size, storage, egress.
- [ ] **OpenAI platform usage dashboard** — the only *real* dollar number
      (the SQL token counts are estimates). Set a budget alert here (§7.6).
- [ ] Resend dashboard — only when alert/invite emails are expected that day.

### 7.5 Weekly review template (before each partner call)

1. **Usage** — questions/day trend, distinct active users (target ≥3 techs),
   peak day as % of the daily cap, month-to-date vs. the 1000 ceiling.
2. **Cost** — OpenAI dashboard actual spend this week (expect single digits);
   any vision-extraction events (scanned uploads); Supabase storage delta.
3. **Quality** — abstain rate and whether the abstains were honest gaps;
   citation rate on answered rows; every blocked/human-review row gets read.
4. **Partner feedback** — "usefully honest" moments; questions the docs
   couldn't answer (doc-expansion candidates); frustrations.
5. **Doc expansion decision** — apply the §7.1 gate; expand or hold, with the
   reason logged.
6. **Cap change decision** — apply the §7.2 test; raise/hold/lower, with the
   reason logged.
7. **Lesson candidates** — recurring question themes → draft → founder review
   → `promote-lesson` (never skip the approval gate).

### 7.6 Alert thresholds

Manual triggers on the daily routine — when one fires, act the same day:

| Signal | Threshold | Action |
|---|---|---|
| Daily AI usage | ≥80% of the daily cap 3 days in a row | Run the §7.2 productive-vs-toy review; raise only if productive |
| Usage spike | >3× the 7-day daily average | Same-day audit-log read; toy/abuse → coach or lower the monthly ceiling |
| Ingestion | ANY `failed` extraction/embedding, or `processing` >30 min | Investigate per [pilot-troubleshooting.md](./pilot-troubleshooting.md); don't let the partner re-upload blindly |
| Chunks | any single doc >400 chunks, or tenant total >2000 | Doc is probably too big/degraded — review before approving more uploads |
| Storage | >80% of tier quota, or >500MB growth in a week | Pause uploads; re-apply the §7.1 intake policy |
| Repeated questions | ≥5 identical `user_message` in a day | Toy usage or UX frustration — ask the partner which |
| Edge functions | non-2xx spike in `field-assistant` logs | Check the AI-gateway circuit breaker and OpenAI status |
| Platform | unresolved **critical** `system_alerts` (these already email via Resend) | Existing §6 flow |
| Spend | OpenAI dashboard >$25/month soft, >$50/month hard (founder sets the budget alert in the OpenAI console — one-time external action) | Investigate vision extraction first; it's the only plausible cause at alpha scale |

### 7.7 Tooling note

A later code PR (**PR-GUARD-2**) will fold the §7.3 queries into
`npm run verify:pilot -- --tenant-id <uuid>` as read-only usage checks, so the
daily routine becomes one command. That is deliberately **not** part of the
docs-only PR that added this section.

---

## 8. Success and exit criteria (per partner, ~6 weeks)

The alpha is working when, without founder prompting:

1. Techs ask Sentinel real questions on real jobs (≥3 active tech-users, steady
   weekly query volume).
2. The partner has caught Sentinel being *usefully honest* at least once
   (either a verified citation or a correct "not in your docs").
3. ≥1 founder-approved lesson exists from their recurring questions and gets
   cited in a later answer.
4. Jobs/clients/invoices are their working system of record, not a demo copy.
5. The owner volunteers a "Coming" feature they'd pay for — that's the broader
   beta sprint's priority signal.

**Exit paths:** (a) convert to paid — blocked until the founder reopens the
Stripe Live track; keep `is_beta_founder=true` so the 50% promise is honored;
(b) continue as extended free design partner (explicit trial extension);
(c) wind down — offer their data (export on request), run the pilot runbook §8
teardown only if they ask for deletion (privacy-policy commitment).

---

## 9. Standing guardrails (unchanged by this runbook)

- Decision A holds: no judge flags for real tenants.
- No pattern flags until PR-PATTERN-GATE ships an approval gate.
- Stripe Live is paused by founder decision — nothing in this runbook touches
  billing, and no partner is ever asked for payment during the alpha.
- Flag changes, tier bumps, and trial extensions are founder actions recorded
  per-tenant; nothing here is automated.
