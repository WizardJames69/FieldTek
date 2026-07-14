import { describe, it, expect } from "vitest";

// The demo-tenant provisioner's decision logic and seed data are pure
// (scripts/lib/demoTenant.ts), so Vitest pins the "narrow, gated,
// synthetic-only" contract offline — no backend, no fgem writes — mirroring
// src/test/evals/provisionPlan.test.ts for the eval provisioner.
import {
  DEMO_TENANT_NAME,
  DEMO_EMAIL_DOMAIN,
  DEMO_USERS,
  PROTECTED_TENANT_NAMES,
  MIN_DEMO_PASSWORD_LENGTH,
  DEMO_ALLOWED_ENTITIES,
  DEMO_FORBIDDEN_ENTITIES,
  assertIsDemoTenantName,
  assertDemoPlanWithinAllowlist,
  buildDemoWritePlan,
  buildDemoSeedPlan,
  decideDemoGate,
  parseDemoArgs,
  extractProjectRef,
  invoiceTotals,
  lineItemTotal,
  materializeInvoiceDates,
  materializeRequestDates,
  type DemoPlannedWrite,
} from "../../../scripts/lib/demoTenant";
import {
  REFRESH_DOMAIN_TABLES,
  buildDomainRefreshDeletePlan,
  assertDomainRefreshScoped,
  decideDomainRefreshGate,
  type DomainRefreshDelete,
} from "../../../scripts/lib/demoTenant";
import {
  aggregateCompletedByWeek,
  hasEnoughTrendData,
} from "@/components/dashboard/JobsTrendChart";

const FGEM_URL = "https://fgemfxhwushaiiguqxfe.supabase.co";
const GOOD_PASSWORDS = {
  ownerPassword: "a-long-demo-password",
  techPassword: "another-long-password",
};
// Fixed mid-week reference so bucketing assertions are deterministic.
const NOW = new Date("2026-06-17T15:00:00Z");

describe("parseDemoArgs", () => {
  const DEFAULTS = { dryRun: false, confirmProject: null, refreshDomain: false, confirmTenantId: null };

  it("defaults to no flags", () => {
    expect(parseDemoArgs([])).toEqual(DEFAULTS);
  });

  it("parses --dry-run and --confirm-project", () => {
    expect(parseDemoArgs(["--dry-run"])).toEqual({ ...DEFAULTS, dryRun: true });
    expect(parseDemoArgs(["--confirm-project", "abc"])).toEqual({
      ...DEFAULTS,
      confirmProject: "abc",
    });
  });
});

describe("decideDemoGate", () => {
  it("is dry-run BY DEFAULT when no --confirm-project is given", () => {
    const gate = decideDemoGate(parseDemoArgs([]), FGEM_URL, GOOD_PASSWORDS);
    expect(gate).toEqual({ ok: true, mode: "dry-run", projectRef: "fgemfxhwushaiiguqxfe" });
  });

  it("stays dry-run when --dry-run accompanies a confirmation", () => {
    const gate = decideDemoGate(
      parseDemoArgs(["--dry-run", "--confirm-project", "fgemfxhwushaiiguqxfe"]),
      FGEM_URL,
      GOOD_PASSWORDS,
    );
    expect(gate).toEqual({ ok: true, mode: "dry-run", projectRef: "fgemfxhwushaiiguqxfe" });
  });

  it("refuses a confirmation that does not match the env project ref", () => {
    const gate = decideDemoGate(
      parseDemoArgs(["--confirm-project", "wrongref"]),
      FGEM_URL,
      GOOD_PASSWORDS,
    );
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toContain("does not match");
  });

  it("refuses to write when VITE_SUPABASE_URL is missing", () => {
    const gate = decideDemoGate(
      parseDemoArgs(["--confirm-project", "fgemfxhwushaiiguqxfe"]),
      undefined,
      GOOD_PASSWORDS,
    );
    expect(gate.ok).toBe(false);
  });

  it.each([
    ["missing owner password", { ...GOOD_PASSWORDS, ownerPassword: undefined }],
    ["missing tech password", { ...GOOD_PASSWORDS, techPassword: undefined }],
    ["short owner password", { ...GOOD_PASSWORDS, ownerPassword: "short" }],
    ["short tech password", { ...GOOD_PASSWORDS, techPassword: "x".repeat(MIN_DEMO_PASSWORD_LENGTH - 1) }],
  ])("refuses to write with %s", (_label, passwords) => {
    const gate = decideDemoGate(
      parseDemoArgs(["--confirm-project", "fgemfxhwushaiiguqxfe"]),
      FGEM_URL,
      passwords,
    );
    expect(gate.ok).toBe(false);
  });

  it("allows a write with matching ref and valid env passwords", () => {
    const gate = decideDemoGate(
      parseDemoArgs(["--confirm-project", "fgemfxhwushaiiguqxfe"]),
      FGEM_URL,
      GOOD_PASSWORDS,
    );
    expect(gate).toEqual({ ok: true, mode: "write", projectRef: "fgemfxhwushaiiguqxfe" });
  });
});

describe("extractProjectRef", () => {
  it("parses supabase URLs and rejects junk", () => {
    expect(extractProjectRef(FGEM_URL)).toBe("fgemfxhwushaiiguqxfe");
    expect(extractProjectRef("not a url")).toBeNull();
    expect(extractProjectRef(undefined)).toBeNull();
  });
});

describe("write plan + allowlist", () => {
  it("stays within the allowlist and touches no forbidden entity", () => {
    expect(() => assertDemoPlanWithinAllowlist(buildDemoWritePlan())).not.toThrow();
  });

  it("throws on a forbidden entity", () => {
    const bad = [
      { entity: "feature_flags", action: "upsert", description: "nope" },
    ] as unknown as DemoPlannedWrite[];
    expect(() => assertDemoPlanWithinAllowlist(bad)).toThrow(/FORBIDDEN/);
  });

  it("throws on a non-allowlisted entity", () => {
    const bad = [
      { entity: "profiles_backup", action: "upsert", description: "nope" },
    ] as unknown as DemoPlannedWrite[];
    expect(() => assertDemoPlanWithinAllowlist(bad)).toThrow(/non-allowlisted/);
  });

  it("keeps the allowlist and forbidden list disjoint, with globals forbidden", () => {
    const allowed = new Set<string>(DEMO_ALLOWED_ENTITIES);
    for (const f of DEMO_FORBIDDEN_ENTITIES) expect(allowed.has(f)).toBe(false);
    expect(DEMO_FORBIDDEN_ENTITIES).toContain("feature_flags");
    expect(DEMO_FORBIDDEN_ENTITIES).toContain("platform_admins");
  });

  it("plans every allowlisted entity exactly once", () => {
    const entities = buildDemoWritePlan().map((w) => w.entity);
    expect(new Set(entities).size).toBe(entities.length);
    expect(new Set(entities)).toEqual(new Set(DEMO_ALLOWED_ENTITIES));
  });
});

describe("protected tenant names", () => {
  it("accepts only the demo tenant name", () => {
    expect(() => assertIsDemoTenantName(DEMO_TENANT_NAME)).not.toThrow();
    expect(() => assertIsDemoTenantName("Jen's HVAC")).toThrow();
  });

  it.each(PROTECTED_TENANT_NAMES.map((n) => [n]))("refuses protected fixture name %s", (name) => {
    expect(() => assertIsDemoTenantName(name)).toThrow(/protected/);
  });

  it("never names the demo tenant after a fixture", () => {
    expect(PROTECTED_TENANT_NAMES).not.toContain(DEMO_TENANT_NAME);
  });
});

describe("demo users", () => {
  it("is 1 owner + 5 technicians, all on the demo domain, with no password fields", () => {
    expect(DEMO_USERS).toHaveLength(6);
    expect(DEMO_USERS.filter((u) => u.role === "owner")).toHaveLength(1);
    expect(DEMO_USERS.filter((u) => u.role === "technician")).toHaveLength(5);
    for (const u of DEMO_USERS) {
      expect(u.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)).toBe(true);
      expect(Object.keys(u)).not.toContain("password");
    }
    expect(new Set(DEMO_USERS.map((u) => u.email)).size).toBe(6);
  });
});

describe("seed plan integrity", () => {
  const plan = buildDemoSeedPlan(NOW);

  it("matches the approved seed volumes", () => {
    expect(plan.clients).toHaveLength(12);
    expect(plan.equipment).toHaveLength(8);
    expect(plan.jobs).toHaveLength(16);
    expect(plan.invoices).toHaveLength(10);
    expect(plan.serviceRequests).toHaveLength(4);
  });

  it("uses unique natural keys (client name, serial, job title, invoice number, request title)", () => {
    expect(new Set(plan.clients.map((c) => c.name)).size).toBe(plan.clients.length);
    expect(new Set(plan.equipment.map((e) => e.serial_number)).size).toBe(plan.equipment.length);
    expect(new Set(plan.jobs.map((j) => j.title)).size).toBe(plan.jobs.length);
    expect(new Set(plan.invoices.map((i) => i.invoice_number)).size).toBe(plan.invoices.length);
    expect(new Set(plan.serviceRequests.map((r) => r.title)).size).toBe(plan.serviceRequests.length);
  });

  it("only references clients, equipment, and technicians that exist in the plan", () => {
    const clientNames = new Set(plan.clients.map((c) => c.name));
    const serials = new Set(plan.equipment.map((e) => e.serial_number));
    const userKeys = new Set(plan.users.map((u) => u.key));
    for (const e of plan.equipment) expect(clientNames.has(e.clientName)).toBe(true);
    for (const j of plan.jobs) {
      expect(clientNames.has(j.clientName)).toBe(true);
      if (j.equipmentSerial) expect(serials.has(j.equipmentSerial)).toBe(true);
      if (j.assignedTo) expect(userKeys.has(j.assignedTo)).toBe(true);
    }
    const jobTitles = new Set(plan.jobs.map((j) => j.title));
    for (const i of plan.invoices) {
      expect(clientNames.has(i.clientName)).toBe(true);
      if (i.jobTitle) expect(jobTitles.has(i.jobTitle)).toBe(true);
    }
    for (const r of plan.serviceRequests) expect(clientNames.has(r.clientName)).toBe(true);
  });

  it("covers the showcase job mix: statuses, urgency, and today's schedule", () => {
    const byStatus = (s: string) => plan.jobs.filter((j) => j.status === s);
    expect(byStatus("completed")).toHaveLength(9);
    expect(byStatus("in_progress")).toHaveLength(1);
    expect(byStatus("cancelled")).toHaveLength(1);
    expect(byStatus("pending").length + byStatus("scheduled").length).toBe(5);

    const urgentOpen = plan.jobs.filter(
      (j) => j.priority === "urgent" && j.status !== "completed" && j.status !== "cancelled",
    );
    expect(urgentOpen).toHaveLength(2);

    const today = NOW.toISOString().slice(0, 10);
    const todays = plan.jobs.filter((j) => j.scheduled_date === today);
    expect(todays).toHaveLength(4);
    expect(todays.some((j) => j.status === "in_progress")).toBe(true);
  });

  it("guarantees the dashboard trend chart renders (real chart bucketing, >=2 non-zero weeks)", () => {
    const completed = plan.jobs.filter((j) => j.status === "completed");
    const weeks = aggregateCompletedByWeek(completed.map((j) => j.updated_at), NOW);
    expect(weeks).toHaveLength(8);
    expect(weeks.reduce((sum, w) => sum + w.completed, 0)).toBe(completed.length);
    expect(hasEnoughTrendData(weeks)).toBe(true);
    expect(weeks.filter((w) => w.completed > 0).length).toBeGreaterThanOrEqual(5);
  });

  it("keeps invoice money math consistent (line totals, subtotal, 5% tax)", () => {
    for (const inv of plan.invoices) {
      const totals = invoiceTotals(inv.lineItems);
      const lineSum = inv.lineItems.reduce((sum, i) => sum + lineItemTotal(i), 0);
      expect(totals.subtotal).toBeCloseTo(lineSum, 2);
      expect(totals.tax_amount).toBe(Math.round(totals.subtotal * 0.05 * 100) / 100);
      expect(totals.total).toBeCloseTo(totals.subtotal + totals.tax_amount, 2);
      expect(inv.lineItems.length).toBeGreaterThan(0);
    }
  });

  it("covers all four invoice statuses with consistent lifecycle fields", () => {
    const byStatus = (s: string) => plan.invoices.filter((i) => i.status === s);
    expect(byStatus("paid")).toHaveLength(4);
    expect(byStatus("sent")).toHaveLength(3);
    expect(byStatus("overdue")).toHaveLength(1);
    expect(byStatus("draft")).toHaveLength(2);
    for (const inv of plan.invoices) {
      if (inv.status === "paid") {
        expect(inv.sentDaysAgo).not.toBeNull();
        expect(inv.paidDaysAgo).not.toBeNull();
        // Paid strictly after sent.
        expect(inv.paidDaysAgo!).toBeLessThan(inv.sentDaysAgo!);
      }
      if (inv.status === "sent" || inv.status === "overdue") {
        expect(inv.sentDaysAgo).not.toBeNull();
        expect(inv.paidDaysAgo).toBeNull();
      }
      if (inv.status === "draft") {
        expect(inv.sentDaysAgo).toBeNull();
        expect(inv.paidDaysAgo).toBeNull();
      }
      if (inv.status === "overdue") expect(inv.daysUntilDue).toBeLessThan(0);
      expect(inv.invoice_number).toMatch(/^INV-\d{6}-[A-Z]{3}$/);
    }
  });

  it("keeps all service requests new and recent", () => {
    for (const r of plan.serviceRequests) {
      expect(r.hoursAgo).toBeGreaterThan(0);
      expect(r.hoursAgo).toBeLessThan(7 * 24);
    }
  });

  it("links at least one unit to the fixture corpus equipment (Carrier 24ACC636)", () => {
    const carrier = plan.equipment.find((e) => e.model === "24ACC636");
    expect(carrier).toBeDefined();
    expect(carrier?.brand).toBe("Carrier");
    expect(plan.jobs.some((j) => j.equipmentSerial === carrier?.serial_number)).toBe(true);
  });
});

describe("domain refresh gates + guards", () => {
  const TENANT_ID = "7476ee6f-7021-4a45-8289-808e2dce48c4";
  const WRITE_ARGS = ["--refresh-domain", "--confirm-project", "fgemfxhwushaiiguqxfe", "--confirm-tenant-id", TENANT_ID];

  it("parses the refresh flags", () => {
    expect(parseDemoArgs(WRITE_ARGS)).toEqual({
      dryRun: false,
      confirmProject: "fgemfxhwushaiiguqxfe",
      refreshDomain: true,
      confirmTenantId: TENANT_ID,
    });
  });

  it("allows refresh only with full write gate + tenant id", () => {
    const gate = decideDomainRefreshGate(parseDemoArgs(WRITE_ARGS), FGEM_URL, GOOD_PASSWORDS);
    expect(gate).toEqual({ ok: true, projectRef: "fgemfxhwushaiiguqxfe", tenantId: TENANT_ID });
  });

  it.each([
    ["without --confirm-tenant-id", ["--refresh-domain", "--confirm-project", "fgemfxhwushaiiguqxfe"]],
    ["without --confirm-project", ["--refresh-domain", "--confirm-tenant-id", TENANT_ID]],
    ["under --dry-run", ["--dry-run", ...WRITE_ARGS]],
  ])("refuses refresh %s", (_label, argv) => {
    expect(decideDomainRefreshGate(parseDemoArgs(argv), FGEM_URL, GOOD_PASSWORDS).ok).toBe(false);
  });

  it("refuses refresh without passwords (inherits the write gate)", () => {
    const gate = decideDomainRefreshGate(parseDemoArgs(WRITE_ARGS), FGEM_URL, {
      ...GOOD_PASSWORDS,
      ownerPassword: undefined,
    });
    expect(gate.ok).toBe(false);
  });

  it("plans deletes for exactly the four domain tables, all tenant-scoped, FK-safe order", () => {
    const plan = buildDomainRefreshDeletePlan(TENANT_ID);
    expect(plan.map((d) => d.table)).toEqual([...REFRESH_DOMAIN_TABLES]);
    expect(plan.map((d) => d.table)).toEqual([
      "invoice_line_items",
      "invoices",
      "scheduled_jobs",
      "service_requests",
    ]);
    for (const d of plan) expect(d.scope.tenant_id).toBe(TENANT_ID);
    expect(() => assertDomainRefreshScoped(plan, TENANT_ID)).not.toThrow();
  });

  it("guard refuses non-domain tables and unscoped deletes", () => {
    const badTable = [
      { table: "clients", scope: { tenant_id: TENANT_ID }, description: "nope" },
    ] as unknown as DomainRefreshDelete[];
    expect(() => assertDomainRefreshScoped(badTable, TENANT_ID)).toThrow(/non-domain/);

    const wrongScope = buildDomainRefreshDeletePlan("other-tenant");
    expect(() => assertDomainRefreshScoped(wrongScope, TENANT_ID)).toThrow(/not scoped/);

    expect(() => assertDomainRefreshScoped(buildDomainRefreshDeletePlan(""), "")).toThrow(/non-empty/);
  });

  it("never plans deletes for durable tables (users/clients/equipment/docs)", () => {
    const tables = new Set<string>(REFRESH_DOMAIN_TABLES);
    for (const durable of ["tenants", "tenant_users", "profiles", "clients", "equipment_registry", "documents", "document_chunks"]) {
      expect(tables.has(durable)).toBe(false);
    }
  });
});

describe("date materialization", () => {
  it("resolves invoice offsets against now with a believable updated_at", () => {
    const plan = buildDemoSeedPlan(NOW);
    const paid = plan.invoices.find((i) => i.status === "paid")!;
    const dates = materializeInvoiceDates(paid, NOW);
    expect(dates.sent_at).not.toBeNull();
    expect(dates.paid_at).not.toBeNull();
    expect(new Date(dates.paid_at!).getTime()).toBeGreaterThan(new Date(dates.sent_at!).getTime());
    expect(dates.updated_at).toBe(dates.paid_at);
    expect(dates.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const draft = plan.invoices.find((i) => i.status === "draft")!;
    const draftDates = materializeInvoiceDates(draft, NOW);
    expect(draftDates.sent_at).toBeNull();
    expect(draftDates.paid_at).toBeNull();
    expect(draftDates.updated_at).toBe(draftDates.created_at);
  });

  it("resolves request ages in hours", () => {
    const req = buildDemoSeedPlan(NOW).serviceRequests[0];
    const dates = materializeRequestDates(req, NOW);
    expect(NOW.getTime() - new Date(dates.created_at).getTime()).toBe(req.hoursAgo * 3_600_000);
    expect(dates.updated_at).toBe(dates.created_at);
  });
});
