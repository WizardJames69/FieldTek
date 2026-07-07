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
3. Have the §5 day-1 flag/tier SQL ready but **do not run it before the tenant
   exists**.

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

**After the call (founder, same day):** run §5 day-1 ops, then §6 monitoring.

---

## 4. Trial, tier, and AI-limit decisions (day 1)

Facts as deployed:

- New tenants get `subscription_tier='trial'`, `trial_ends_at = now() + 30 days`
  (DB default; migration `20260208151124`).
- Sentinel AI is limited **per tenant per UTC day** by tier
  (`TIER_DAILY_LIMITS`, field-assistant): trial **10**, starter 25, growth 50,
  professional 200. Ten queries/day is too tight for a whole crew genuinely
  testing the assistant.
- `expire-stale-trials` (cron) flips expired trials to `cancelled`, and DB
  triggers then block new jobs/technicians. An expired design partner mid-alpha
  would be a bad surprise.

**Recommended day-1 posture** (each a deliberate founder action, run with the
service role after the tenant exists):

```sql
-- 1. Founding-member status (drives the 50%-off coupon when billing starts;
--    costs nothing now)
update public.tenants set is_beta_founder = true where id = '<tenant_uuid>';

-- 2. Lift the AI daily cap for a real crew (professional = 200/day/tenant)
update public.tenants set subscription_tier = 'professional' where id = '<tenant_uuid>';

-- 3. (When the trial nears expiry and the partnership is working) extend it:
update public.tenants set trial_ends_at = now() + interval '30 days' where id = '<tenant_uuid>';
```

> **Gotcha — why the manual tier bump is currently stable:** `check-subscription`
> reconciles the DB tier against Stripe on every billing-page load, but it
> throws immediately on `fgem` because no `STRIPE_SECRET_KEY` is set — so the
> manual tier survives. **The day Stripe secrets are set on `fgem`** (sandbox
> verification or Live flip), reconciliation will find no Stripe subscription
> and rewrite the partner back to `trial`/`trial`. Re-check every design-partner
> tenant's tier as part of any future Stripe wiring step (this is also noted in
> the Stripe Live readiness plan).

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

Verify afterwards: `npm run verify:pilot -- --tenant-id <tenant_uuid>` — expect
these two flags effective-ON for the tenant, judge flags OFF, and treat any
other drift as a stop-and-investigate.

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
      their tier limit — if they hit the cap, that's a *good* problem; raise it
      deliberately (§4), don't let them discover a silent 429.
- [ ] `/admin/system-health`: no unresolved critical alerts.
- [ ] `workflow_intelligence` capture is actually accruing once jobs complete
      (`workflow_intelligence_edges` rows for the tenant) — silence after
      completed jobs means the flag or the completion path needs a look.

**Weekly (before each partner call):**

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

## 7. Success and exit criteria (per partner, ~6 weeks)

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

## 8. Standing guardrails (unchanged by this runbook)

- Decision A holds: no judge flags for real tenants.
- No pattern flags until PR-PATTERN-GATE ships an approval gate.
- Stripe Live is paused by founder decision — nothing in this runbook touches
  billing, and no partner is ever asked for payment during the alpha.
- Flag changes, tier bumps, and trial extensions are founder actions recorded
  per-tenant; nothing here is automated.
