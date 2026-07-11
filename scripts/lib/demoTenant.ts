// ============================================================
// North Shore HVAC demo tenant — pure planning + seed data (PR-DEMO-1)
// ============================================================
// The Product Showcase milestone needs ONE believable, fully synthetic demo
// tenant on the canonical backend so real product screenshots (dashboard,
// Sentinel) can replace landing-page div-art. This module is the pure decision
// core: identity constants, the gate logic (dry-run by default, write only with
// an explicit matching --confirm-project AND operator-supplied passwords), the
// write allowlist/forbidden guards, and every seed row as deterministic data
// relative to a passed `now`. No IO — unit-tested offline
// (src/test/scripts/demoTenant.test.ts) so the "narrow, gated, synthetic-only"
// contract is pinned without any backend writes. The IO lives in
// scripts/provision-demo-tenant.ts.
//
// Modeled on evals/provisionPlan.ts (the eval tenant provisioner), with two
// deliberate differences: passwords come from the operator's environment (a
// demo login is shown on screens — it must never be a repo literal), and the
// seed is a full workspace (clients/jobs/invoices/requests/equipment) instead
// of a minimal corpus-only tenant.

import { addDays, addWeeks, formatISO, startOfWeek, subDays } from "date-fns";

// ── Identity ────────────────────────────────────────────────

/** Durable demo tenant name — fully synthetic, never a real customer. */
export const DEMO_TENANT_NAME = "North Shore HVAC";

/** Slug prefix for the demo tenant (timestamp suffix keeps each slug unique). */
export const DEMO_TENANT_SLUG_PREFIX = "north-shore-hvac";

export const DEMO_TENANT_INDUSTRY = "hvac" as const;

/** All demo logins live on this reserved, non-deliverable domain. */
export const DEMO_EMAIL_DOMAIN = "fieldtek-demo.dev";

/**
 * Auth user_metadata marker for demo users. Distinct from the E2E suite's
 * `e2e_test_data` and the eval harness's `eval_test_data` markers so no
 * marker-based cleanup in either suite can ever match a demo user.
 */
export const DEMO_USER_MARKER = "demo_tenant_data";

/**
 * Tenant names this script must NEVER resolve, adopt, or write to. The E2E
 * fixtures are deleted by global-teardown after every CI run; the eval tenant
 * is the live-baseline anchor. Colliding with either has burned us before
 * (see evals/evalIdentity.ts) — guard by name before any tenant write.
 */
export const PROTECTED_TENANT_NAMES = [
  "E2E Test Company",
  "E2E Tenant B - Isolation",
  "Sentinel Eval Company",
] as const;

export function assertIsDemoTenantName(name: string): void {
  for (const protectedName of PROTECTED_TENANT_NAMES) {
    if (name === protectedName) {
      throw new Error(
        `refusing: tenant name "${name}" is a protected E2E/eval fixture, not the demo tenant`,
      );
    }
  }
  if (name !== DEMO_TENANT_NAME) {
    throw new Error(`refusing: tenant name "${name}" is not "${DEMO_TENANT_NAME}"`);
  }
}

// ── People (synthetic — no real persons or customers implied) ──

export interface DemoUserSpec {
  /** Stable key used to wire seed rows to users (never stored in the DB). */
  key: "owner" | "tech-1" | "tech-2" | "tech-3" | "tech-4" | "tech-5";
  email: string;
  fullName: string;
  role: "owner" | "technician";
}

export const DEMO_USERS: DemoUserSpec[] = [
  { key: "owner", email: `demo-owner@${DEMO_EMAIL_DOMAIN}`, fullName: "Dana Whitfield", role: "owner" },
  { key: "tech-1", email: `demo-tech-1@${DEMO_EMAIL_DOMAIN}`, fullName: "Marcus Webb", role: "technician" },
  { key: "tech-2", email: `demo-tech-2@${DEMO_EMAIL_DOMAIN}`, fullName: "Priya Sharma", role: "technician" },
  { key: "tech-3", email: `demo-tech-3@${DEMO_EMAIL_DOMAIN}`, fullName: "Dale Kowalski", role: "technician" },
  { key: "tech-4", email: `demo-tech-4@${DEMO_EMAIL_DOMAIN}`, fullName: "Ana Reyes", role: "technician" },
  { key: "tech-5", email: `demo-tech-5@${DEMO_EMAIL_DOMAIN}`, fullName: "Tom Okafor", role: "technician" },
];

// ── Gate logic ──────────────────────────────────────────────

export interface DemoProvisionArgs {
  dryRun: boolean;
  confirmProject: string | null;
}

export function parseDemoArgs(argv: string[]): DemoProvisionArgs {
  const args: DemoProvisionArgs = { dryRun: false, confirmProject: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--confirm-project") args.confirmProject = argv[++i] ?? null;
  }
  return args;
}

/** Extract the project ref from a Supabase URL: https://<ref>.supabase.co → <ref>. */
export function extractProjectRef(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = /https?:\/\/([a-z0-9]+)\.supabase\.(co|in|net)/i.exec(url);
  return m ? m[1] : null;
}

export const MIN_DEMO_PASSWORD_LENGTH = 12;

export interface DemoPasswordEnv {
  ownerPassword: string | undefined;
  techPassword: string | undefined;
}

export type DemoGateDecision =
  | { ok: true; mode: "dry-run"; projectRef: string | null }
  | { ok: true; mode: "write"; projectRef: string }
  | { ok: false; reason: string };

/**
 * Decide whether/how to proceed. DRY-RUN IS THE DEFAULT: with no arguments the
 * script only prints its plan — it cannot write. A real write requires an
 * explicit --confirm-project matching the ref in VITE_SUPABASE_URL AND both
 * demo passwords supplied via environment (DEMO_OWNER_PASSWORD /
 * DEMO_TECH_PASSWORD, ≥12 chars). Passwords are operator-supplied because the
 * demo login appears on screens and in the founder's password manager — it
 * must never exist as a repo literal.
 */
export function decideDemoGate(
  args: DemoProvisionArgs,
  envUrl: string | undefined | null,
  passwords: DemoPasswordEnv,
): DemoGateDecision {
  const ref = extractProjectRef(envUrl);
  if (args.dryRun || !args.confirmProject) {
    return { ok: true, mode: "dry-run", projectRef: ref };
  }
  if (!ref) {
    return {
      ok: false,
      reason: "VITE_SUPABASE_URL is missing or not a Supabase URL, so the target project cannot be confirmed.",
    };
  }
  if (args.confirmProject !== ref) {
    return {
      ok: false,
      reason: `--confirm-project "${args.confirmProject}" does not match target project "${ref}" (from VITE_SUPABASE_URL).`,
    };
  }
  for (const [name, value] of [
    ["DEMO_OWNER_PASSWORD", passwords.ownerPassword],
    ["DEMO_TECH_PASSWORD", passwords.techPassword],
  ] as const) {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        reason: `${name} is not set. Generate it in the password manager and export it for this run; demo passwords are never repo literals.`,
      };
    }
    if (value.length < MIN_DEMO_PASSWORD_LENGTH) {
      return { ok: false, reason: `${name} is shorter than ${MIN_DEMO_PASSWORD_LENGTH} characters.` };
    }
  }
  return { ok: true, mode: "write", projectRef: ref };
}

// ── Write plan + allowlist ──────────────────────────────────

/**
 * The ONLY entities this provisioner may write. `auth.user` is the Supabase
 * Auth Admin API (demo logins); the rest are tables, all tenant-scoped to the
 * single demo tenant. Corpus chunks reuse the checked-in embedding fixture —
 * no model calls.
 */
export const DEMO_ALLOWED_ENTITIES = [
  "auth.user",
  "profiles",
  "tenants",
  "tenant_users",
  "tenant_settings",
  "tenant_branding",
  "tenant_ai_policies",
  "onboarding_progress",
  "clients",
  "equipment_registry",
  "scheduled_jobs",
  "invoices",
  "invoice_line_items",
  "service_requests",
  "documents",
  "document_chunks",
] as const;
export type DemoEntity = (typeof DEMO_ALLOWED_ENTITIES)[number];

/**
 * Entities this provisioner must NEVER touch: anything global (flags, platform
 * admins), anything belonging to the AI learning/compliance/graph pipelines,
 * and any DELETE anywhere. Encoded so a runtime guard + unit tests can prove
 * the plan stays narrow.
 */
export const DEMO_FORBIDDEN_ENTITIES = [
  "feature_flags", // GLOBAL — would affect other tenants
  "platform_admins",
  "beta_applications",
  "compliance_rules",
  "equipment_components",
  "component_relationships",
  "workflow_symptoms",
  "workflow_failures",
  "workflow_repairs",
  "workflow_outcomes",
  "workflow_intelligence_edges",
  "workflow_diagnostic_statistics",
  "lesson_citations",
  "ai_audit_log",
] as const;

export interface DemoPlannedWrite {
  entity: DemoEntity;
  action: "insert-if-missing" | "upsert";
  description: string;
}

/** The fixed, explicit set of writes — ordered by dependency. */
export function buildDemoWritePlan(): DemoPlannedWrite[] {
  return [
    { entity: "auth.user", action: "insert-if-missing", description: `6 demo logins (@${DEMO_EMAIL_DOMAIN}), marked ${DEMO_USER_MARKER}` },
    { entity: "profiles", action: "upsert", description: "profile rows for the 6 demo users" },
    { entity: "tenants", action: "insert-if-missing", description: `demo tenant "${DEMO_TENANT_NAME}" (professional/active, slug ${DEMO_TENANT_SLUG_PREFIX}-*)` },
    { entity: "tenant_users", action: "insert-if-missing", description: "owner + 5 technician memberships" },
    { entity: "tenant_settings", action: "upsert", description: "HVAC equipment/job types, workflow stages, CAD/5% tax" },
    { entity: "tenant_branding", action: "upsert", description: "North Shore HVAC company branding" },
    { entity: "tenant_ai_policies", action: "upsert", description: "AI enabled, max_monthly_requests=1000 (pilot guardrail parity)" },
    { entity: "onboarding_progress", action: "upsert", description: "onboarding complete (hides the checklist)" },
    { entity: "clients", action: "insert-if-missing", description: "12 synthetic commercial/residential clients (by name)" },
    { entity: "equipment_registry", action: "insert-if-missing", description: "8 units with warranty spread (by serial number)" },
    { entity: "scheduled_jobs", action: "insert-if-missing", description: "16 jobs: 8-week completed history + today + upcoming (by title)" },
    { entity: "invoices", action: "insert-if-missing", description: "10 invoices across draft/sent/paid/overdue (by invoice number)" },
    { entity: "invoice_line_items", action: "insert-if-missing", description: "line items inserted only with a new parent invoice" },
    { entity: "service_requests", action: "insert-if-missing", description: "4 new inbound requests (by title)" },
    { entity: "documents", action: "insert-if-missing", description: "fixture HVAC corpus documents (file_url null, text-only)" },
    { entity: "document_chunks", action: "insert-if-missing", description: "fixture chunks + checked-in embeddings (no model calls)" },
  ];
}

/** Throw if a plan references anything outside the allowlist or on the forbidden list. */
export function assertDemoPlanWithinAllowlist(plan: DemoPlannedWrite[]): void {
  const allowed = new Set<string>(DEMO_ALLOWED_ENTITIES);
  const forbidden = new Set<string>(DEMO_FORBIDDEN_ENTITIES);
  for (const w of plan) {
    if (forbidden.has(w.entity)) {
      throw new Error(`demo plan contains FORBIDDEN entity "${w.entity}"`);
    }
    if (!allowed.has(w.entity)) {
      throw new Error(`demo plan contains non-allowlisted entity "${w.entity}"`);
    }
  }
}

// ── Seed data builders (pure, deterministic relative to `now`) ──

/** ISO timestamp helper — full precision, UTC-ish local ISO. */
function iso(d: Date): string {
  return d.toISOString();
}

/** Date-only helper (YYYY-MM-DD) for date columns. */
function day(d: Date): string {
  return formatISO(d, { representation: "date" });
}

/**
 * Monday of the current week — the same weekStartsOn:1 bucketing the dashboard
 * trend chart uses (src/components/dashboard/JobsTrendChart.tsx), so completed
 * history lands in deterministic chart buckets regardless of the run weekday.
 */
function currentWeekMonday(now: Date): Date {
  return startOfWeek(now, { weekStartsOn: 1 });
}

export interface DemoClientSeed {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  notes: string | null;
}

/** 12 synthetic clients. Business names are fictional; streets are generic. */
export function buildDemoClients(): DemoClientSeed[] {
  const c = (
    name: string,
    email: string,
    phone: string,
    address: string,
    zip: string,
    notes: string | null = null,
  ): DemoClientSeed => ({
    name,
    email,
    phone,
    address,
    city: "North Vancouver",
    state: "BC",
    zip_code: zip,
    notes,
  });
  return [
    c("Seabreeze Apartments", "manager@seabreeze-apts.example", "604-555-0141", "1204 Marine Dr", "V7P 1S9", "Strata contact prefers morning visits. Mechanical room key at front desk."),
    c("Marine Drive Bakery", "owner@marinedrivebakery.example", "604-555-0172", "1877 Marine Dr", "V7P 1V5", "Walk-in cooler and rooftop unit. Access before 6am or after 2pm."),
    c("Grouse Ridge Dental", "admin@grouseridgedental.example", "604-555-0119", "3049 Edgemont Blvd", "V7R 2N5", null),
    c("Deep Cove Yoga Studio", "hello@deepcoveyoga.example", "604-555-0163", "4310 Gallant Ave", "V7G 1L2", "Quiet hours during classes — text before arriving."),
    c("Cedar Lane Townhomes", "council@cedarlane-strata.example", "604-555-0187", "735 Cedar Lane", "V7J 2X4", "14-unit strata. Annual maintenance contract."),
    c("Harbourside Bistro", "chef@harboursidebistro.example", "604-555-0134", "221 Esplanade E", "V7L 1A3", "Kitchen make-up air unit plus two splits in dining room."),
    c("Westview Community Centre", "facilities@westviewcc.example", "604-555-0158", "2601 Westview Dr", "V7N 3X1", "PO required for work over $500."),
    c("Parkgate Physiotherapy", "reception@parkgatephysio.example", "604-555-0126", "3650 Mt Seymour Pkwy", "V7H 2Y5", null),
    c("Sunrise Seniors Residence", "maintenance@sunriseseniors.example", "604-555-0195", "150 W 15th St", "V7M 1R5", "Priority response — vulnerable residents. Site induction required."),
    c("Mosquito Creek Brewing", "ops@mosquitocreekbrewing.example", "604-555-0148", "980 W 1st St", "V7P 3N4", "Glycol chiller is under a separate service agreement."),
    c("Edgemont Village Books", "shop@edgemontbooks.example", "604-555-0112", "3065 Highland Blvd", "V7R 2X4", null),
    c("Blueline Auto Group", "service@bluelineauto.example", "604-555-0179", "800 Automall Dr", "V7P 3R8", "Shop heaters x3, showroom rooftop unit."),
  ];
}

export interface DemoEquipmentSeed {
  /** Client name this unit belongs to (resolved to client_id at write time). */
  clientName: string;
  equipment_type: string;
  brand: string;
  model: string;
  serial_number: string;
  installYearsAgo: number;
  warrantyYearsFromInstall: number;
  status: string;
  location_notes: string | null;
}

/**
 * 8 units with a believable warranty spread. The first unit deliberately
 * matches the fixture corpus (Carrier / 24ACC636 / Air Handler) so a live
 * Sentinel conversation with job context can cite the seeded manual.
 */
export function buildDemoEquipment(): DemoEquipmentSeed[] {
  return [
    { clientName: "Seabreeze Apartments", equipment_type: "Air Handler", brand: "Carrier", model: "24ACC636", serial_number: "DEMO-CAR-24AC-0018", installYearsAgo: 2, warrantyYearsFromInstall: 5, status: "active", location_notes: "Rooftop, northeast corner. Roof hatch access from 4th floor." },
    { clientName: "Marine Drive Bakery", equipment_type: "Rooftop Unit", brand: "Lennox", model: "LGH048H4B", serial_number: "DEMO-LEN-LGH-2204", installYearsAgo: 4, warrantyYearsFromInstall: 5, status: "active", location_notes: "Above kitchen. Ladder access at rear lane." },
    { clientName: "Grouse Ridge Dental", equipment_type: "Heat Pump", brand: "Mitsubishi", model: "MSZ-FS12NA", serial_number: "DEMO-MIT-FS12-0931", installYearsAgo: 1, warrantyYearsFromInstall: 10, status: "active", location_notes: "Two indoor heads, operatories 1 and 2." },
    { clientName: "Cedar Lane Townhomes", equipment_type: "Furnace", brand: "Trane", model: "S9V2B080", serial_number: "DEMO-TRA-S9V2-1147", installYearsAgo: 7, warrantyYearsFromInstall: 10, status: "active", location_notes: "Unit 7 crawlspace. Shared flue inspected 2024." },
    { clientName: "Harbourside Bistro", equipment_type: "Make-Up Air Unit", brand: "Greenheck", model: "MSX-108", serial_number: "DEMO-GRE-MSX-0442", installYearsAgo: 6, warrantyYearsFromInstall: 3, status: "active", location_notes: "Interlocked with kitchen exhaust. Belt spares in office." },
    { clientName: "Sunrise Seniors Residence", equipment_type: "Boiler", brand: "Viessmann", model: "Vitodens 100-W", serial_number: "DEMO-VIE-V100-2210", installYearsAgo: 3, warrantyYearsFromInstall: 10, status: "active", location_notes: "Mechanical room B1. Combustion air louvre cleaned quarterly." },
    { clientName: "Mosquito Creek Brewing", equipment_type: "Air Conditioner", brand: "Goodman", model: "GSX140361", serial_number: "DEMO-GOO-GSX-0785", installYearsAgo: 5, warrantyYearsFromInstall: 10, status: "active", location_notes: "Condenser on grade behind taproom, locked cage." },
    { clientName: "Blueline Auto Group", equipment_type: "Unit Heater", brand: "Reznor", model: "UDX-100", serial_number: "DEMO-REZ-UDX-1503", installYearsAgo: 9, warrantyYearsFromInstall: 3, status: "active", location_notes: "Bay 2 of 3. Two sister units same model." },
  ];
}

export type DemoUserKey = DemoUserSpec["key"];

export interface DemoJobSeed {
  title: string;
  description: string;
  clientName: string;
  /** Technician key, or null for unassigned. */
  assignedTo: DemoUserKey | null;
  status: "pending" | "scheduled" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  scheduled_date: string;
  scheduled_time: string | null;
  job_type: string;
  address: string;
  estimated_duration: number | null;
  /** Serial number of the linked unit, when one applies. */
  equipmentSerial: string | null;
  /** Explicit timestamps so history reads believably (and feeds the trend chart). */
  created_at: string;
  updated_at: string;
}

/**
 * 16 jobs: 9 completed spread over the last 8 calendar weeks (Monday buckets,
 * matching the dashboard trend chart's aggregation so the chart is guaranteed
 * to render), 4 today (one in progress, one urgent), 2 upcoming (one urgent),
 * 1 cancelled. Completed rows carry explicit past `updated_at` values — that
 * is the timestamp the trend chart buckets on.
 */
export function buildDemoJobs(now: Date): DemoJobSeed[] {
  const monday = currentWeekMonday(now);
  const clients = buildDemoClients();
  const addr = (name: string): string => {
    const c = clients.find((x) => x.name === name);
    return c ? `${c.address}, ${c.city}` : "North Vancouver";
  };

  // A completed job `weeksAgo` calendar weeks back, completed Tue..Thu so the
  // bucket never straddles a week boundary regardless of the run weekday.
  const done = (
    weeksAgo: number,
    dayOffset: number,
    title: string,
    clientName: string,
    tech: DemoUserKey,
    jobType: string,
    description: string,
    equipmentSerial: string | null = null,
    priority: DemoJobSeed["priority"] = "medium",
  ): DemoJobSeed => {
    const completedAt = new Date(addDays(addWeeks(monday, -weeksAgo), dayOffset));
    completedAt.setHours(15, 30, 0, 0);
    const createdAt = subDays(completedAt, 3);
    return {
      title,
      description,
      clientName,
      assignedTo: tech,
      status: "completed",
      priority,
      scheduled_date: day(completedAt),
      scheduled_time: "09:00:00",
      job_type: jobType,
      address: addr(clientName),
      estimated_duration: 120,
      equipmentSerial,
      created_at: iso(createdAt),
      updated_at: iso(completedAt),
    };
  };

  const today = day(now);

  return [
    // ── Completed history (weeks ago: 7,6,6,5,4,3,2,2,1 → 7 non-zero buckets) ──
    done(7, 1, "Fall furnace tune-up - Cedar Lane Townhomes", "Cedar Lane Townhomes", "tech-3", "Maintenance", "Annual furnace inspection and tune-up for units 1-7. Filters replaced, heat exchangers inspected, CO readings logged."),
    done(6, 1, "Rooftop unit belt replacement - Marine Drive Bakery", "Marine Drive Bakery", "tech-1", "Repair", "Replaced worn blower belt on LGH048, checked pulley alignment, verified airflow at registers.", "DEMO-LEN-LGH-2204"),
    done(6, 3, "Quarterly filter service - Sunrise Seniors Residence", "Sunrise Seniors Residence", "tech-4", "Maintenance", "Replaced all common-area filters, cleaned boiler room combustion air louvre, logged readings."),
    done(5, 2, "Heat pump commissioning - Grouse Ridge Dental", "Grouse Ridge Dental", "tech-2", "Installation", "Commissioned two new indoor heads, verified refrigerant charge and condensate routing, walked client through controls.", "DEMO-MIT-FS12-0931"),
    done(4, 2, "Make-up air interlock fault - Harbourside Bistro", "Harbourside Bistro", "tech-1", "Repair", "Diagnosed exhaust interlock fault, replaced faulty relay, verified kitchen pressure balance.", "DEMO-GRE-MSX-0442", "high"),
    done(3, 1, "Condenser coil cleaning - Mosquito Creek Brewing", "Mosquito Creek Brewing", "tech-5", "Maintenance", "Cleaned condenser coil, straightened fins, verified subcooling within spec.", "DEMO-GOO-GSX-0785"),
    done(2, 1, "Air handler startup check - Seabreeze Apartments", "Seabreeze Apartments", "tech-1", "Maintenance", "Seasonal startup on the Carrier 24ACC636: verified thermostat sequencing, disconnect, and compressor delay per manual startup procedure.", "DEMO-CAR-24AC-0018"),
    done(2, 3, "Unit heater ignition repair - Blueline Auto Group", "Blueline Auto Group", "tech-3", "Repair", "Replaced flame sensor on bay 2 unit heater, cleaned burner assembly, cycled unit five times to confirm ignition.", "DEMO-REZ-UDX-1503"),
    done(1, 2, "Boiler quarterly inspection - Sunrise Seniors Residence", "Sunrise Seniors Residence", "tech-4", "Inspection", "Quarterly boiler inspection: combustion analysis, relief valve check, logged pressures in maintenance binder.", "DEMO-VIE-V100-2210"),

    // ── Today (4 jobs: one in progress, one urgent intake) ──
    {
      title: "AC not cooling - Seabreeze Apartments unit 302",
      description: "Tenant reports weak cooling. Check thermostat mode, filter restriction, and refrigerant charge against the 24ACC636 manual.",
      clientName: "Seabreeze Apartments",
      assignedTo: "tech-1",
      status: "in_progress",
      priority: "high",
      scheduled_date: today,
      scheduled_time: "09:00:00",
      job_type: "Repair",
      address: addr("Seabreeze Apartments"),
      estimated_duration: 120,
      equipmentSerial: "DEMO-CAR-24AC-0018",
      created_at: iso(subDays(now, 1)),
      updated_at: iso(now),
    },
    {
      title: "Walk-in cooler temp check - Marine Drive Bakery",
      description: "Routine temperature verification and door gasket inspection on the walk-in cooler.",
      clientName: "Marine Drive Bakery",
      assignedTo: "tech-2",
      status: "scheduled",
      priority: "medium",
      scheduled_date: today,
      scheduled_time: "11:30:00",
      job_type: "Maintenance",
      address: addr("Marine Drive Bakery"),
      estimated_duration: 60,
      equipmentSerial: null,
      created_at: iso(subDays(now, 2)),
      updated_at: iso(subDays(now, 2)),
    },
    {
      title: "Filter and belt service - Westview Community Centre",
      description: "Scheduled filter change across gym and multi-purpose rooms; inspect AHU belt tension.",
      clientName: "Westview Community Centre",
      assignedTo: "tech-5",
      status: "scheduled",
      priority: "medium",
      scheduled_date: today,
      scheduled_time: "14:00:00",
      job_type: "Maintenance",
      address: addr("Westview Community Centre"),
      estimated_duration: 90,
      equipmentSerial: null,
      created_at: iso(subDays(now, 3)),
      updated_at: iso(subDays(now, 3)),
    },
    {
      title: "No heat call - Sunrise Seniors Residence east wing",
      description: "East wing radiators cold since early morning. Boiler running but loop pump suspect. Priority site — vulnerable residents.",
      clientName: "Sunrise Seniors Residence",
      assignedTo: null,
      status: "pending",
      priority: "urgent",
      scheduled_date: today,
      scheduled_time: null,
      job_type: "Repair",
      address: addr("Sunrise Seniors Residence"),
      estimated_duration: null,
      equipmentSerial: "DEMO-VIE-V100-2210",
      created_at: iso(now),
      updated_at: iso(now),
    },

    // ── Upcoming ──
    {
      title: "Compressor hard-start diagnosis - Mosquito Creek Brewing",
      description: "Taproom AC compressor struggling to start during afternoon peak. Suspect run capacitor — bring 45/5 µF spare.",
      clientName: "Mosquito Creek Brewing",
      assignedTo: "tech-1",
      status: "scheduled",
      priority: "urgent",
      scheduled_date: day(addDays(now, 1)),
      scheduled_time: "08:30:00",
      job_type: "Repair",
      address: addr("Mosquito Creek Brewing"),
      estimated_duration: 120,
      equipmentSerial: "DEMO-GOO-GSX-0785",
      created_at: iso(now),
      updated_at: iso(now),
    },
    {
      title: "Spring maintenance visit - Parkgate Physiotherapy",
      description: "Seasonal maintenance: filters, coil rinse, condensate line flush, thermostat battery.",
      clientName: "Parkgate Physiotherapy",
      assignedTo: "tech-4",
      status: "scheduled",
      priority: "low",
      scheduled_date: day(addDays(now, 3)),
      scheduled_time: "10:00:00",
      job_type: "Maintenance",
      address: addr("Parkgate Physiotherapy"),
      estimated_duration: 90,
      equipmentSerial: null,
      created_at: iso(subDays(now, 1)),
      updated_at: iso(subDays(now, 1)),
    },

    // ── Cancelled (client rescheduled) ──
    {
      title: "Showroom RTU inspection - Blueline Auto Group",
      description: "Client postponed showroom rooftop inspection to next quarter.",
      clientName: "Blueline Auto Group",
      assignedTo: "tech-3",
      status: "cancelled",
      priority: "low",
      scheduled_date: day(subDays(now, 5)),
      scheduled_time: "13:00:00",
      job_type: "Inspection",
      address: addr("Blueline Auto Group"),
      estimated_duration: 60,
      equipmentSerial: null,
      created_at: iso(subDays(now, 9)),
      updated_at: iso(subDays(now, 5)),
    },
  ];
}

export interface DemoLineItemSeed {
  description: string;
  quantity: number;
  unit_price: number;
  item_type: "labor" | "part" | "service";
}

export interface DemoInvoiceSeed {
  invoice_number: string;
  clientName: string;
  /** Title of the job this invoice bills, when one applies. */
  jobTitle: string | null;
  status: "draft" | "sent" | "paid" | "overdue";
  lineItems: DemoLineItemSeed[];
  /** Derived: subtotal/tax/total are computed, never hand-written. */
  daysUntilDue: number;
  sentDaysAgo: number | null;
  paidDaysAgo: number | null;
  notes: string | null;
}

export const DEMO_TAX_RATE = 0.05; // GST — matches tenant_settings.tax_rate = 5

export function lineItemTotal(item: DemoLineItemSeed): number {
  return Math.round(item.quantity * item.unit_price * 100) / 100;
}

export function invoiceTotals(items: DemoLineItemSeed[]): {
  subtotal: number;
  tax_amount: number;
  total: number;
} {
  const subtotal = Math.round(items.reduce((sum, i) => sum + lineItemTotal(i), 0) * 100) / 100;
  const tax_amount = Math.round(subtotal * DEMO_TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax_amount) * 100) / 100;
  return { subtotal, tax_amount, total };
}

/** 10 invoices: 4 paid, 3 sent, 1 overdue, 2 draft. Numbers follow the app's INV-######-XXX shape. */
export function buildDemoInvoices(): DemoInvoiceSeed[] {
  const labor = (hours: number, rate = 120): DemoLineItemSeed => ({
    description: `Labor - ${hours} hr @ $${rate}/hr`,
    quantity: hours,
    unit_price: rate,
    item_type: "labor",
  });
  return [
    { invoice_number: "INV-240101-NSH", clientName: "Cedar Lane Townhomes", jobTitle: "Fall furnace tune-up - Cedar Lane Townhomes", status: "paid", daysUntilDue: 30, sentDaysAgo: 46, paidDaysAgo: 38, notes: "Annual maintenance contract visit 2 of 4.", lineItems: [ { description: "Furnace tune-up (7 units, contract rate)", quantity: 7, unit_price: 129, item_type: "service" }, { description: "16x25x1 pleated filters", quantity: 7, unit_price: 18.5, item_type: "part" } ] },
    { invoice_number: "INV-240102-NSH", clientName: "Marine Drive Bakery", jobTitle: "Rooftop unit belt replacement - Marine Drive Bakery", status: "paid", daysUntilDue: 30, sentDaysAgo: 40, paidDaysAgo: 31, notes: null, lineItems: [ { description: "Blower belt AX42", quantity: 1, unit_price: 34.75, item_type: "part" }, labor(1.5) ] },
    { invoice_number: "INV-240103-NSH", clientName: "Grouse Ridge Dental", jobTitle: "Heat pump commissioning - Grouse Ridge Dental", status: "paid", daysUntilDue: 30, sentDaysAgo: 32, paidDaysAgo: 20, notes: "Commissioning per installation quote Q-1188.", lineItems: [ { description: "Heat pump commissioning package", quantity: 1, unit_price: 480, item_type: "service" }, { description: "Condensate pump", quantity: 1, unit_price: 96.4, item_type: "part" } ] },
    { invoice_number: "INV-240104-NSH", clientName: "Harbourside Bistro", jobTitle: "Make-up air interlock fault - Harbourside Bistro", status: "paid", daysUntilDue: 14, sentDaysAgo: 24, paidDaysAgo: 12, notes: null, lineItems: [ { description: "Diagnostic service call", quantity: 1, unit_price: 145, item_type: "service" }, { description: "Interlock relay 24V", quantity: 1, unit_price: 58.2, item_type: "part" }, labor(2) ] },
    { invoice_number: "INV-240105-NSH", clientName: "Blueline Auto Group", jobTitle: "Unit heater ignition repair - Blueline Auto Group", status: "overdue", daysUntilDue: -10, sentDaysAgo: 24, paidDaysAgo: null, notes: "Second reminder scheduled.", lineItems: [ { description: "Flame sensor", quantity: 1, unit_price: 42.9, item_type: "part" }, labor(1.5) ] },
    { invoice_number: "INV-240106-NSH", clientName: "Mosquito Creek Brewing", jobTitle: "Condenser coil cleaning - Mosquito Creek Brewing", status: "sent", daysUntilDue: 21, sentDaysAgo: 6, paidDaysAgo: null, notes: null, lineItems: [ { description: "Condenser coil clean and fin comb", quantity: 1, unit_price: 210, item_type: "service" } ] },
    { invoice_number: "INV-240107-NSH", clientName: "Seabreeze Apartments", jobTitle: "Air handler startup check - Seabreeze Apartments", status: "sent", daysUntilDue: 30, sentDaysAgo: 4, paidDaysAgo: null, notes: "Strata billing — attention council treasurer.", lineItems: [ { description: "Seasonal startup inspection", quantity: 1, unit_price: 185, item_type: "service" }, { description: "20x20x2 media filter", quantity: 2, unit_price: 27.3, item_type: "part" } ] },
    { invoice_number: "INV-240108-NSH", clientName: "Sunrise Seniors Residence", jobTitle: "Boiler quarterly inspection - Sunrise Seniors Residence", status: "sent", daysUntilDue: 30, sentDaysAgo: 2, paidDaysAgo: null, notes: null, lineItems: [ { description: "Quarterly boiler inspection and combustion analysis", quantity: 1, unit_price: 265, item_type: "service" } ] },
    { invoice_number: "INV-240109-NSH", clientName: "Westview Community Centre", jobTitle: null, status: "draft", daysUntilDue: 30, sentDaysAgo: null, paidDaysAgo: null, notes: "Awaiting PO number before sending.", lineItems: [ { description: "Filter service - gym and multi-purpose rooms", quantity: 1, unit_price: 240, item_type: "service" }, { description: "24x24x2 pleated filters", quantity: 6, unit_price: 21.8, item_type: "part" } ] },
    { invoice_number: "INV-240110-NSH", clientName: "Deep Cove Yoga Studio", jobTitle: null, status: "draft", daysUntilDue: 30, sentDaysAgo: null, paidDaysAgo: null, notes: null, lineItems: [ { description: "Mini-split deep clean (2 heads)", quantity: 2, unit_price: 149, item_type: "service" } ] },
  ];
}

export interface MaterializedInvoiceDates {
  due_date: string;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Resolve an invoice seed's relative offsets against `now`. `updated_at`
 * mirrors the last real state change (paid > sent > created) so the dashboard
 * activity feed orders these rows believably.
 */
export function materializeInvoiceDates(seed: DemoInvoiceSeed, now: Date): MaterializedInvoiceDates {
  const sentAt = seed.sentDaysAgo !== null ? iso(subDays(now, seed.sentDaysAgo)) : null;
  const paidAt = seed.paidDaysAgo !== null ? iso(subDays(now, seed.paidDaysAgo)) : null;
  const createdAt = seed.sentDaysAgo !== null ? iso(subDays(now, seed.sentDaysAgo + 1)) : iso(subDays(now, 1));
  return {
    due_date: day(addDays(now, seed.daysUntilDue)),
    sent_at: sentAt,
    paid_at: paidAt,
    created_at: createdAt,
    updated_at: paidAt ?? sentAt ?? createdAt,
  };
}

/** Resolve a service request seed's age against `now`. */
export function materializeRequestDates(seed: DemoServiceRequestSeed, now: Date): {
  created_at: string;
  updated_at: string;
} {
  const createdAt = iso(new Date(now.getTime() - seed.hoursAgo * 3_600_000));
  return { created_at: createdAt, updated_at: createdAt };
}

export interface DemoServiceRequestSeed {
  title: string;
  description: string;
  clientName: string;
  priority: "low" | "medium" | "high" | "urgent";
  request_type: string;
  hoursAgo: number;
}

/** 4 inbound requests, all status "new" (feeds the dashboard requests widget + activity feed). */
export function buildDemoServiceRequests(): DemoServiceRequestSeed[] {
  return [
    { title: "No heat in unit 304", description: "Resident in 304 reports no heat since last night. Baseboards cold, thermostat set to 22.", clientName: "Seabreeze Apartments", priority: "urgent", request_type: "repair", hoursAgo: 3 },
    { title: "AC making grinding noise", description: "Rooftop unit above the taproom makes a grinding noise at startup, then settles. Worried about the bearing.", clientName: "Mosquito Creek Brewing", priority: "high", request_type: "repair", hoursAgo: 18 },
    { title: "Quote request - server room cooling", description: "We are converting a storage room to a small server room and need a quote for a dedicated cooling unit.", clientName: "Blueline Auto Group", priority: "medium", request_type: "quote", hoursAgo: 41 },
    { title: "Annual maintenance plan renewal", description: "Our maintenance agreement is up next month. Please send renewal terms for the four-visit plan.", clientName: "Parkgate Physiotherapy", priority: "low", request_type: "maintenance", hoursAgo: 66 },
  ];
}

/** Everything the runner seeds, in one bundle (handy for dry-run summaries + tests). */
export interface DemoSeedPlan {
  users: DemoUserSpec[];
  clients: DemoClientSeed[];
  equipment: DemoEquipmentSeed[];
  jobs: DemoJobSeed[];
  invoices: DemoInvoiceSeed[];
  serviceRequests: DemoServiceRequestSeed[];
}

export function buildDemoSeedPlan(now: Date): DemoSeedPlan {
  return {
    users: DEMO_USERS,
    clients: buildDemoClients(),
    equipment: buildDemoEquipment(),
    jobs: buildDemoJobs(now),
    invoices: buildDemoInvoices(),
    serviceRequests: buildDemoServiceRequests(),
  };
}

/** One-line-per-entity summary for the dry-run banner. */
export function describeSeedPlan(plan: DemoSeedPlan): string[] {
  const completed = plan.jobs.filter((j) => j.status === "completed").length;
  const urgentOpen = plan.jobs.filter(
    (j) => j.priority === "urgent" && j.status !== "completed" && j.status !== "cancelled",
  ).length;
  return [
    `  • users               ${plan.users.length} (1 owner + ${plan.users.length - 1} technicians, @${DEMO_EMAIL_DOMAIN})`,
    `  • clients             ${plan.clients.length}`,
    `  • equipment_registry  ${plan.equipment.length}`,
    `  • scheduled_jobs      ${plan.jobs.length} (${completed} completed over 8 weeks, ${urgentOpen} urgent open)`,
    `  • invoices            ${plan.invoices.length} (+ line items)`,
    `  • service_requests    ${plan.serviceRequests.length} (all "new")`,
    `  • documents/chunks    fixture HVAC corpus (checked-in embeddings, no model calls)`,
  ];
}
