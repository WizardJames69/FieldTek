# North Shore HVAC Demo Tenant Runbook (PR-DEMO-1)

The Product Showcase milestone replaces landing-page div-art with real product
screenshots. Those screenshots need a believable, populated workspace. This
runbook provisions that workspace: **North Shore HVAC**, a fully synthetic demo
tenant on the canonical backend (`fgemfxhwushaiiguqxfe`).

**Honesty rule:** every row is synthetic. No real customer, partner, or person
is represented. Anywhere these screens appear publicly, use the caption
"Product shown with sample data."

## What gets provisioned

| Entity | Volume | Notes |
|---|---|---|
| Auth users | 6 | `demo-owner@fieldtek-demo.dev` + `demo-tech-1..5@fieldtek-demo.dev` |
| Tenant | 1 | "North Shore HVAC", hvac, **professional/active** (no trial banner) |
| Memberships | 6 | 1 owner + 5 technicians |
| Settings/branding/AI policy | 3 rows | CAD, 5% tax, America/Vancouver; AI enabled with `max_monthly_requests=1000` (pilot guardrail parity). Branding colors are deliberately null so the tenant renders the stock FieldTek theme (orange) — landing screenshots must match the brand |
| Onboarding progress | 1 row | fully complete — hides the dashboard checklist |
| Clients | 12 | fictional North Vancouver businesses |
| Equipment | 8 | warranty spread; one unit is Carrier 24ACC636 (matches the document corpus) |
| Jobs | 16 | 9 completed across the last 8 weeks (lights the dashboard trend chart), 4 today (1 in progress, 1 urgent), 2 upcoming (1 urgent), 1 cancelled |
| Invoices | 10 (+ line items) | 4 paid / 3 sent / 1 overdue / 2 draft, consistent totals, GST 5% |
| Service requests | 4 | all status `new` |
| Documents + chunks | 3 docs | fixture HVAC corpus with **checked-in embeddings** — zero model calls; `file_url` is null (text-only, same shape as lesson documents) |

The script is **idempotent** (natural-key lookups: client name, serial number,
job title, invoice number, request title) and **never deletes anything**. Line
items are only inserted together with a new parent invoice.

## Safety model

- **Dry-run is the default.** Without `--confirm-project` the script only
  prints its plan. `--dry-run` forces preview even with a confirmation.
- **Write mode requires all of:**
  1. `.env.test` with `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`;
  2. `--confirm-project <ref>` matching the ref inside `VITE_SUPABASE_URL`;
  3. `DEMO_OWNER_PASSWORD` and `DEMO_TECH_PASSWORD` in the environment
     (≥12 chars). **Passwords live in the founder's password manager — never
     in the repo, never in shell history files you commit, never printed by
     the script.**
- A write-plan allowlist is asserted at runtime; `feature_flags`,
  `platform_admins`, compliance/graph/workflow-intelligence tables and
  `lesson_citations` are on an explicit forbidden list.
- Protected tenant names ("E2E Test Company", "E2E Tenant B - Isolation",
  "Sentinel Eval Company") are refused by a hard guard — the demo tenant can
  never collide with the E2E or eval fixtures.
- **Survives CI:** E2E global-teardown deletes only its own run-scoped tenant
  and user ids (plus the `E2E-TEST-ACCESS-CODE` beta application). North Shore
  HVAC and `@fieldtek-demo.dev` users never match those, so the tenant is
  durable across E2E runs.
- The decision logic and all seed data are pure and unit-tested offline:
  `src/test/scripts/demoTenant.test.ts` (34 tests, run in `npm run test`).

## Running it

### 1. Preview (safe anywhere, no DB connection)

```bash
npm run demo:provision
# or explicitly:
npm run demo:provision -- --dry-run
```

### 2. Provision (founder-gated)

Only with explicit founder approval, and only in an E2E quiet window (no CI
E2E run in progress — check the Actions tab; concurrent runs contend for auth
rate limits).

```bash
# 1. Generate two strong passwords in the password manager first:
#    - "FieldTek demo owner (demo-owner@fieldtek-demo.dev)"
#    - "FieldTek demo technicians (demo-tech-1..5@fieldtek-demo.dev)"
# 2. Run with the passwords supplied inline (leading space keeps most shells
#    from writing the line to history):
 DEMO_OWNER_PASSWORD='<from password manager>' \
 DEMO_TECH_PASSWORD='<from password manager>' \
 npm run demo:provision -- --confirm-project fgemfxhwushaiiguqxfe
```

Re-running is safe: existing rows are found, not duplicated, and user
passwords are re-aligned to the environment values on every run (so a password
rotation is just "update the manager, re-run").

### Re-centering the demo clock (`--refresh-domain`)

Seeded dates are relative to run time, so the showcase dashboard ("today's
jobs", activity ages, the 8-week trend) goes stale within a day of the last
run. A plain re-run does NOT fix this (found rows are skipped), and an
UPDATE-based refresh cannot work: these tables carry a `BEFORE UPDATE`
trigger that stamps `updated_at = now()`, which destroys the historical
timestamps the trend chart and activity feed render.

The supported refresh is a harder-gated **delete + reseed of exactly the
date-anchored rows** (invoice line items, invoices, jobs, service requests —
demo-tenant-scoped; users/clients/equipment/documents are never touched):

```bash
 DEMO_OWNER_PASSWORD='…' DEMO_TECH_PASSWORD='…' \
 npm run demo:provision -- --confirm-project fgemfxhwushaiiguqxfe \
   --refresh-domain --confirm-tenant-id <demo tenant id>
```

Run it right before any demo or screenshot session (founder-approved, quiet
window). Row ids change; nothing outside the demo tenant references them.

### 3. Verify

- Log in at the app as `demo-owner@fieldtek-demo.dev`.
- Dashboard: no onboarding checklist, no trial banner; stats populated; quick
  actions; Today's jobs (4, one in progress, one urgent); activity feed mixing
  jobs/invoices/requests; **Completed Jobs trend chart visible** (8-week
  history); 4 new requests.
- Jobs/Clients/Invoices pages populated; invoice totals internally consistent.
- Sentinel: ask e.g. "What is the startup procedure for the Carrier 24ACC636?"
  — expect a grounded answer with document citations (corpus + AI policy are
  seeded; usage counts against the 1000/month cap).
- Technician view: log in as `demo-tech-1@fieldtek-demo.dev` (Marcus Webb) —
  My Jobs shows today's in-progress AC call.

## Screenshot etiquette (feeds PR-LAND-SHOT-1)

- Caption anything public: **"Product shown with sample data."**
- Never mix demo-tenant screenshots with real-tenant data in one frame.
- The Sentinel conversation for screenshots must be a LIVE conversation in the
  demo tenant (chat history is ephemeral by design); run it in a quiet window.

## Cleanup (manual, if ever needed)

There is deliberately no delete path in the script. To remove the demo tenant:
Supabase dashboard → delete the "North Shore HVAC" tenant row (cascades to all
tenant-scoped rows), then delete the six `@fieldtek-demo.dev` auth users. Do
not script this without a new gated plan.
