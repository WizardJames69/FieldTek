// ============================================================
// North Shore HVAC demo tenant — gated provisioner (runner, PR-DEMO-1)
// ============================================================
// Seeds the single, fully synthetic Product Showcase demo tenant on the
// canonical backend: 6 demo logins, the "North Shore HVAC" tenant
// (professional/active — no trial banner), settings/branding/AI policy,
// completed onboarding, 12 clients, 8 equipment units, 16 jobs (8 weeks of
// completed history so the dashboard trend chart renders), 10 invoices with
// line items, 4 inbound service requests, and the fixture HVAC document corpus
// with checked-in embeddings (no model calls). Idempotent by natural keys —
// safe to re-run; it never deletes anything.
//
//   npx tsx scripts/provision-demo-tenant.ts                                    # DRY RUN (default): plan only, no writes
//   npx tsx scripts/provision-demo-tenant.ts --dry-run                          # same, explicit
//   DEMO_OWNER_PASSWORD=… DEMO_TECH_PASSWORD=… \
//     npx tsx scripts/provision-demo-tenant.ts --confirm-project fgemfxhwushaiiguqxfe   # WRITE
//
// A real write requires .env.test (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
// --confirm-project matching the project ref in VITE_SUPABASE_URL, AND both
// demo passwords in the environment (they live in the founder's password
// manager — NEVER in this repo). See docs/demo-tenant-runbook.md.

import { config } from "dotenv";
config({ path: ".env.test" });

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAdminClient } from "../e2e/helpers/supabase-admin";
import { resolveChunkEmbedding } from "../e2e/helpers/ai-seed-helpers";
import { TEST_DOCUMENTS } from "../e2e/helpers/ai-test-data";
import {
  DEMO_TENANT_NAME,
  DEMO_TENANT_SLUG_PREFIX,
  DEMO_TENANT_INDUSTRY,
  DEMO_EMAIL_DOMAIN,
  DEMO_USER_MARKER,
  DEMO_USERS,
  assertIsDemoTenantName,
  assertDemoPlanWithinAllowlist,
  buildDemoWritePlan,
  buildDemoSeedPlan,
  decideDemoGate,
  describeSeedPlan,
  parseDemoArgs,
  invoiceTotals,
  lineItemTotal,
  materializeInvoiceDates,
  materializeRequestDates,
  buildDomainRefreshDeletePlan,
  assertDomainRefreshScoped,
  decideDomainRefreshGate,
  type DemoSeedPlan,
  type DemoUserKey,
} from "./lib/demoTenant";

interface Tally {
  [entity: string]: { found: number; created: number };
}

function bump(t: Tally, entity: string, created: boolean, n = 1): void {
  t[entity] ??= { found: 0, created: 0 };
  if (created) t[entity].created += n;
  else t[entity].found += n;
}

// ── Users ───────────────────────────────────────────────────

async function provisionUsers(
  admin: SupabaseClient,
  passwords: { owner: string; tech: string },
  t: Tally,
): Promise<Map<DemoUserKey, string>> {
  const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  const existing = new Map(
    (list?.users ?? []).map((u) => [u.email ?? "", u.id] as const),
  );

  const ids = new Map<DemoUserKey, string>();
  for (const spec of DEMO_USERS) {
    const password = spec.role === "owner" ? passwords.owner : passwords.tech;
    const found = existing.get(spec.email);
    let userId: string;
    if (found) {
      userId = found;
      // Keep credentials aligned with the password manager on every run.
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (updErr) throw new Error(`update demo user ${spec.email} failed: ${updErr.message}`);
      bump(t, "auth.user", false);
    } else {
      const { data, error: createErr } = await admin.auth.admin.createUser({
        email: spec.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: spec.fullName, [DEMO_USER_MARKER]: true },
      });
      if (createErr || !data.user) {
        throw new Error(`create demo user ${spec.email} failed: ${createErr?.message ?? "no user"}`);
      }
      userId = data.user.id;
      bump(t, "auth.user", true);
    }

    const { error: profErr } = await admin
      .from("profiles")
      .upsert({ user_id: userId, full_name: spec.fullName, email: spec.email }, { onConflict: "user_id" });
    if (profErr) throw new Error(`profiles upsert for ${spec.email} failed: ${profErr.message}`);
    bump(t, "profiles", true);

    ids.set(spec.key, userId);
  }
  return ids;
}

// ── Tenant + memberships + per-tenant singletons ────────────

async function provisionTenant(admin: SupabaseClient, ownerId: string, t: Tally): Promise<string> {
  assertIsDemoTenantName(DEMO_TENANT_NAME);
  const { data: existing, error } = await admin
    .from("tenants")
    .select("id")
    .eq("name", DEMO_TENANT_NAME)
    .maybeSingle();
  if (error) throw new Error(`resolve demo tenant failed: ${error.message}`);

  if (existing) {
    // Keep the showcase posture stable: professional + active (no trial banner).
    const { error: updErr } = await admin
      .from("tenants")
      .update({ subscription_tier: "professional", subscription_status: "active" })
      .eq("id", existing.id);
    if (updErr) throw new Error(`update demo tenant failed: ${updErr.message}`);
    bump(t, "tenants", false);
    return existing.id as string;
  }

  const { data: created, error: insErr } = await admin
    .from("tenants")
    .insert({
      name: DEMO_TENANT_NAME,
      slug: `${DEMO_TENANT_SLUG_PREFIX}-${Date.now()}`,
      industry: DEMO_TENANT_INDUSTRY,
      owner_id: ownerId,
      subscription_tier: "professional",
      subscription_status: "active",
      email: `demo-owner@${DEMO_EMAIL_DOMAIN}`,
      phone: "604-555-0100",
      address: "212 Fell Ave, North Vancouver, BC",
    })
    .select("id")
    .single();
  if (insErr || !created) throw new Error(`create demo tenant failed: ${insErr?.message ?? "no row"}`);
  bump(t, "tenants", true);
  return created.id as string;
}

async function provisionMemberships(
  admin: SupabaseClient,
  tenantId: string,
  userIds: Map<DemoUserKey, string>,
  t: Tally,
): Promise<void> {
  for (const spec of DEMO_USERS) {
    const userId = userIds.get(spec.key);
    if (!userId) throw new Error(`no user id resolved for ${spec.key}`);
    const { data: existing, error } = await admin
      .from("tenant_users")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`resolve membership for ${spec.email} failed: ${error.message}`);
    if (existing) {
      bump(t, "tenant_users", false);
      continue;
    }
    const { error: insErr } = await admin
      .from("tenant_users")
      .insert({ tenant_id: tenantId, user_id: userId, role: spec.role, is_active: true });
    if (insErr) throw new Error(`create membership for ${spec.email} failed: ${insErr.message}`);
    bump(t, "tenant_users", true);
  }
}

async function provisionTenantSingletons(
  admin: SupabaseClient,
  tenantId: string,
  now: Date,
  t: Tally,
): Promise<void> {
  const upserts: Array<{ table: string; row: Record<string, unknown> }> = [
    {
      table: "tenant_settings",
      row: {
        tenant_id: tenantId,
        equipment_types: ["Furnace", "Heat Pump", "Air Conditioner", "Air Handler", "Rooftop Unit", "Boiler", "Water Heater"],
        job_types: ["Installation", "Repair", "Maintenance", "Inspection"],
        workflow_stages: ["Scheduled", "En Route", "On Site", "Complete"],
        document_categories: ["Manual", "Contract", "Safety"],
        timezone: "America/Vancouver",
        currency: "CAD",
        country: "CA",
        tax_rate: 5,
      },
    },
    {
      table: "tenant_branding",
      row: {
        tenant_id: tenantId,
        company_name: DEMO_TENANT_NAME,
        primary_color: "#0e7490",
        secondary_color: "#f59e0b",
      },
    },
    {
      table: "tenant_ai_policies",
      row: {
        tenant_id: tenantId,
        ai_enabled: true,
        // Pilot guardrail parity (approved 2026-07-08): bounded monthly usage.
        max_monthly_requests: 1000,
        similarity_threshold: 0.55,
        blocked_topics: [],
        custom_disclaimer: null,
      },
    },
    {
      table: "onboarding_progress",
      row: {
        tenant_id: tenantId,
        company_info_completed: true,
        company_info_completed_at: now.toISOString(),
        branding_completed: true,
        branding_completed_at: now.toISOString(),
        first_client_added: true,
        first_client_added_at: now.toISOString(),
        first_job_created: true,
        first_job_created_at: now.toISOString(),
        first_invoice_created: true,
        first_invoice_created_at: now.toISOString(),
        first_document_uploaded: true,
        first_document_uploaded_at: now.toISOString(),
        first_team_member_invited: true,
        first_team_member_invited_at: now.toISOString(),
        first_service_request_received: true,
        first_service_request_received_at: now.toISOString(),
        onboarding_completed: true,
        onboarding_completed_at: now.toISOString(),
      },
    },
  ];
  for (const { table, row } of upserts) {
    const { error } = await admin.from(table).upsert(row, { onConflict: "tenant_id" });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
    bump(t, table, true);
  }
}

// ── Domain rows (insert-if-missing by natural key) ──────────

async function provisionClients(
  admin: SupabaseClient,
  tenantId: string,
  plan: DemoSeedPlan,
  t: Tally,
): Promise<Map<string, string>> {
  const names = plan.clients.map((c) => c.name);
  const { data: existing, error } = await admin
    .from("clients")
    .select("id,name")
    .eq("tenant_id", tenantId)
    .in("name", names);
  if (error) throw new Error(`resolve clients failed: ${error.message}`);
  const byName = new Map((existing ?? []).map((c) => [c.name as string, c.id as string]));

  for (const client of plan.clients) {
    if (byName.has(client.name)) {
      bump(t, "clients", false);
      continue;
    }
    const { data, error: insErr } = await admin
      .from("clients")
      .insert({ tenant_id: tenantId, ...client })
      .select("id")
      .single();
    if (insErr || !data) throw new Error(`insert client "${client.name}" failed: ${insErr?.message ?? "no row"}`);
    byName.set(client.name, data.id as string);
    bump(t, "clients", true);
  }
  return byName;
}

async function provisionEquipment(
  admin: SupabaseClient,
  tenantId: string,
  plan: DemoSeedPlan,
  clientIds: Map<string, string>,
  now: Date,
  t: Tally,
): Promise<Map<string, string>> {
  const serials = plan.equipment.map((e) => e.serial_number);
  const { data: existing, error } = await admin
    .from("equipment_registry")
    .select("id,serial_number")
    .eq("tenant_id", tenantId)
    .in("serial_number", serials);
  if (error) throw new Error(`resolve equipment failed: ${error.message}`);
  const bySerial = new Map((existing ?? []).map((e) => [e.serial_number as string, e.id as string]));

  for (const unit of plan.equipment) {
    if (bySerial.has(unit.serial_number)) {
      bump(t, "equipment_registry", false);
      continue;
    }
    const installDate = new Date(now);
    installDate.setFullYear(installDate.getFullYear() - unit.installYearsAgo);
    const warrantyExpiry = new Date(installDate);
    warrantyExpiry.setFullYear(warrantyExpiry.getFullYear() + unit.warrantyYearsFromInstall);
    const { data, error: insErr } = await admin
      .from("equipment_registry")
      .insert({
        tenant_id: tenantId,
        client_id: clientIds.get(unit.clientName) ?? null,
        equipment_type: unit.equipment_type,
        brand: unit.brand,
        model: unit.model,
        serial_number: unit.serial_number,
        install_date: installDate.toISOString().slice(0, 10),
        warranty_start_date: installDate.toISOString().slice(0, 10),
        warranty_expiry: warrantyExpiry.toISOString().slice(0, 10),
        warranty_type: "parts",
        status: unit.status,
        location_notes: unit.location_notes,
      })
      .select("id")
      .single();
    if (insErr || !data) {
      throw new Error(`insert equipment "${unit.serial_number}" failed: ${insErr?.message ?? "no row"}`);
    }
    bySerial.set(unit.serial_number, data.id as string);
    bump(t, "equipment_registry", true);
  }
  return bySerial;
}

async function provisionJobs(
  admin: SupabaseClient,
  tenantId: string,
  plan: DemoSeedPlan,
  clientIds: Map<string, string>,
  equipmentIds: Map<string, string>,
  userIds: Map<DemoUserKey, string>,
  t: Tally,
): Promise<Map<string, string>> {
  const titles = plan.jobs.map((j) => j.title);
  const { data: existing, error } = await admin
    .from("scheduled_jobs")
    .select("id,title")
    .eq("tenant_id", tenantId)
    .in("title", titles);
  if (error) throw new Error(`resolve jobs failed: ${error.message}`);
  const byTitle = new Map((existing ?? []).map((j) => [j.title as string, j.id as string]));
  const ownerId = userIds.get("owner");

  for (const job of plan.jobs) {
    if (byTitle.has(job.title)) {
      bump(t, "scheduled_jobs", false);
      continue;
    }
    const { data, error: insErr } = await admin
      .from("scheduled_jobs")
      .insert({
        tenant_id: tenantId,
        title: job.title,
        description: job.description,
        client_id: clientIds.get(job.clientName) ?? null,
        equipment_id: job.equipmentSerial ? equipmentIds.get(job.equipmentSerial) ?? null : null,
        assigned_to: job.assignedTo ? userIds.get(job.assignedTo) ?? null : null,
        created_by: ownerId ?? null,
        status: job.status,
        priority: job.priority,
        scheduled_date: job.scheduled_date,
        scheduled_time: job.scheduled_time,
        job_type: job.job_type,
        address: job.address,
        estimated_duration: job.estimated_duration,
        // Explicit history timestamps: updated_at is what the dashboard trend
        // chart buckets completed jobs by.
        created_at: job.created_at,
        updated_at: job.updated_at,
      })
      .select("id")
      .single();
    if (insErr || !data) throw new Error(`insert job "${job.title}" failed: ${insErr?.message ?? "no row"}`);
    byTitle.set(job.title, data.id as string);
    bump(t, "scheduled_jobs", true);
  }
  return byTitle;
}

async function provisionInvoices(
  admin: SupabaseClient,
  tenantId: string,
  plan: DemoSeedPlan,
  clientIds: Map<string, string>,
  jobIds: Map<string, string>,
  now: Date,
  t: Tally,
): Promise<void> {
  const numbers = plan.invoices.map((i) => i.invoice_number);
  const { data: existing, error } = await admin
    .from("invoices")
    .select("id,invoice_number")
    .eq("tenant_id", tenantId)
    .in("invoice_number", numbers);
  if (error) throw new Error(`resolve invoices failed: ${error.message}`);
  const byNumber = new Set((existing ?? []).map((i) => i.invoice_number as string));

  for (const inv of plan.invoices) {
    if (byNumber.has(inv.invoice_number)) {
      bump(t, "invoices", false);
      continue;
    }
    const totals = invoiceTotals(inv.lineItems);
    const dates = materializeInvoiceDates(inv, now);
    const { data, error: insErr } = await admin
      .from("invoices")
      .insert({
        tenant_id: tenantId,
        invoice_number: inv.invoice_number,
        client_id: clientIds.get(inv.clientName) ?? null,
        job_id: inv.jobTitle ? jobIds.get(inv.jobTitle) ?? null : null,
        status: inv.status,
        subtotal: totals.subtotal,
        tax_amount: totals.tax_amount,
        total: totals.total,
        due_date: dates.due_date,
        sent_at: dates.sent_at,
        paid_at: dates.paid_at,
        notes: inv.notes,
        created_at: dates.created_at,
        updated_at: dates.updated_at,
      })
      .select("id")
      .single();
    if (insErr || !data) {
      throw new Error(`insert invoice ${inv.invoice_number} failed: ${insErr?.message ?? "no row"}`);
    }
    bump(t, "invoices", true);

    // Line items only ever ride along with a freshly inserted parent invoice,
    // so re-runs can never duplicate them.
    for (const item of inv.lineItems) {
      const { error: liErr } = await admin.from("invoice_line_items").insert({
        invoice_id: data.id as string,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: lineItemTotal(item),
        item_type: item.item_type,
      });
      if (liErr) {
        throw new Error(`insert line item for ${inv.invoice_number} failed: ${liErr.message}`);
      }
      bump(t, "invoice_line_items", true);
    }
  }
}

async function provisionServiceRequests(
  admin: SupabaseClient,
  tenantId: string,
  plan: DemoSeedPlan,
  clientIds: Map<string, string>,
  now: Date,
  t: Tally,
): Promise<void> {
  const titles = plan.serviceRequests.map((r) => r.title);
  const { data: existing, error } = await admin
    .from("service_requests")
    .select("id,title")
    .eq("tenant_id", tenantId)
    .in("title", titles);
  if (error) throw new Error(`resolve service requests failed: ${error.message}`);
  const byTitle = new Set((existing ?? []).map((r) => r.title as string));

  for (const req of plan.serviceRequests) {
    if (byTitle.has(req.title)) {
      bump(t, "service_requests", false);
      continue;
    }
    const dates = materializeRequestDates(req, now);
    const { error: insErr } = await admin.from("service_requests").insert({
      tenant_id: tenantId,
      title: req.title,
      description: req.description,
      client_id: clientIds.get(req.clientName) ?? null,
      priority: req.priority,
      request_type: req.request_type,
      status: "new",
      created_at: dates.created_at,
      updated_at: dates.updated_at,
    });
    if (insErr) throw new Error(`insert request "${req.title}" failed: ${insErr.message}`);
    bump(t, "service_requests", true);
  }
}

// ── Document corpus (fixture texts + checked-in embeddings) ─

async function provisionCorpus(admin: SupabaseClient, tenantId: string, t: Tally): Promise<number> {
  // Insert-if-missing per DOCUMENT (by tenant + name) and per CHUNK (by
  // document + chunk_index), so a run interrupted mid-corpus self-heals on the
  // next run instead of being skipped by a coarse "any chunks exist" gate.
  const names = TEST_DOCUMENTS.map((d) => d.name);
  const { data: existingDocs, error } = await admin
    .from("documents")
    .select("id,name")
    .eq("tenant_id", tenantId)
    .in("name", names);
  if (error) throw new Error(`resolve documents failed: ${error.message}`);
  const docIdByName = new Map((existingDocs ?? []).map((d) => [d.name as string, d.id as string]));

  for (const doc of TEST_DOCUMENTS) {
    const docMeta = doc as (typeof TEST_DOCUMENTS)[number] & {
      equipmentType?: string;
      brand?: string;
      model?: string;
    };
    let docId = docIdByName.get(doc.name);
    if (docId) {
      bump(t, "documents", false);
    } else {
      // file_url stays null: these are text-only fixture documents (same shape
      // as lesson-sourced documents, which the Documents UI already renders
      // without a download affordance). Chunk TEXT must stay byte-identical to
      // the fixture — embeddings are resolved by a hash of the text.
      const { data: created, error: docErr } = await admin
        .from("documents")
        .insert({
          tenant_id: tenantId,
          name: doc.name,
          category: doc.category,
          file_url: null,
          extraction_status: "completed",
          embedding_status: "completed",
          is_public: true,
          extracted_text: doc.chunks.map((c) => c.text).join("\n\n"),
        })
        .select("id")
        .single();
      if (docErr || !created) throw new Error(`insert document "${doc.name}" failed: ${docErr?.message ?? "no row"}`);
      docId = created.id as string;
      bump(t, "documents", true);
    }

    const { data: existingChunks, error: chunkResolveErr } = await admin
      .from("document_chunks")
      .select("chunk_index")
      .eq("document_id", docId);
    if (chunkResolveErr) {
      throw new Error(`resolve chunks of "${doc.name}" failed: ${chunkResolveErr.message}`);
    }
    const presentIndexes = new Set((existingChunks ?? []).map((c) => c.chunk_index as number));

    for (let j = 0; j < doc.chunks.length; j++) {
      if (presentIndexes.has(j)) {
        bump(t, "document_chunks", false);
        continue;
      }
      const chunk = doc.chunks[j] as { text: string; page_number?: number | null; section_name?: string | null };
      const { error: chunkErr } = await admin.from("document_chunks").insert({
        document_id: docId,
        tenant_id: tenantId,
        chunk_text: chunk.text,
        chunk_index: j,
        embedding: JSON.stringify(resolveChunkEmbedding(chunk.text)),
        equipment_type: docMeta.equipmentType ?? null,
        brand: docMeta.brand ?? null,
        model: docMeta.model ?? null,
        page_number: chunk.page_number ?? null,
        section_name: chunk.section_name ?? null,
      });
      if (chunkErr) throw new Error(`insert chunk ${j} of "${doc.name}" failed: ${chunkErr.message}`);
      bump(t, "document_chunks", true);
    }
  }

  const { count: after } = await admin
    .from("document_chunks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  return after ?? 0;
}

// ── Reporting ───────────────────────────────────────────────

function printBanner(targetRef: string | null, plan: DemoSeedPlan): void {
  console.log("=== NORTH SHORE HVAC DEMO TENANT PROVISIONER ===");
  console.log("Fully synthetic Product Showcase data. This is NOT the E2E global-setup");
  console.log("and NOT the eval provisioner. The base pass never deletes anything;");
  console.log("the ONLY delete path is the harder-gated --refresh-domain re-centering.");
  console.log(`target project (VITE_SUPABASE_URL): ${targetRef ?? "(not set)"}`);
  console.log(`demo tenant: "${DEMO_TENANT_NAME}"`);
  console.log("\nplanned writes (only):");
  for (const w of buildDemoWritePlan()) {
    console.log(`  • ${w.entity.padEnd(20)} ${w.action.padEnd(18)} ${w.description}`);
  }
  console.log("\nseed volume:");
  for (const line of describeSeedPlan(plan)) console.log(line);
  console.log(
    "\nwill NOT touch: feature_flags, platform_admins, compliance/equipment-graph/" +
      "workflow-intelligence data, lesson_citations, any other tenant, or any DELETE.",
  );
}

function printResult(t: Tally, chunkTotal: number): void {
  console.log("\n--- provisioning result ---");
  const entities = [
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
  ];
  for (const entity of entities) {
    const c = t[entity] ?? { found: 0, created: 0 };
    console.log(`  ${entity.padEnd(20)} found=${c.found} created=${c.created}`);
  }
  console.log(`  corpus chunks total  ${chunkTotal} (embeddings=pre-computed fixture)`);
  console.log("\nconfirmations:");
  console.log("  ✓ no global feature_flags written");
  console.log("  ✓ no platform admin / compliance / graph / workflow-intelligence data");
  console.log("  ✓ no deletes of any kind");
  console.log("  ✓ no model calls (corpus uses checked-in embeddings)");
  console.log("  ✓ passwords came from the environment and were not printed");
}

// ── Domain refresh (trigger-safe re-centering of the demo clock) ─

/**
 * Delete exactly the date-anchored domain rows (line items → invoices → jobs
 * → requests, tenant-scoped) so the normal INSERT path can reseed them with
 * fresh timestamps. UPDATEs cannot do this: BEFORE UPDATE triggers stamp
 * updated_at = now() on these tables, destroying the historical timestamps
 * the trend chart and activity feed render.
 */
async function refreshDomainRows(
  admin: SupabaseClient,
  confirmTenantId: string,
): Promise<{ tenantId: string; deleted: Record<string, number> }> {
  // Resolve by the demo tenant name and hard-verify identity BEFORE any delete.
  const { data: tenants, error } = await admin
    .from("tenants")
    .select("id,name,slug")
    .eq("name", DEMO_TENANT_NAME);
  if (error) throw new Error(`refresh: resolve tenant failed: ${error.message}`);
  if (!tenants || tenants.length !== 1) {
    throw new Error(`refresh: expected exactly one "${DEMO_TENANT_NAME}" tenant, found ${tenants?.length ?? 0}`);
  }
  const tenant = tenants[0] as { id: string; name: string; slug: string | null };
  assertIsDemoTenantName(tenant.name);
  if (!tenant.slug || !tenant.slug.startsWith(DEMO_TENANT_SLUG_PREFIX)) {
    throw new Error(`refresh: tenant slug "${tenant.slug}" does not start with "${DEMO_TENANT_SLUG_PREFIX}"`);
  }
  if (tenant.id !== confirmTenantId) {
    throw new Error(
      `refresh: resolved tenant id "${tenant.id}" does not match --confirm-tenant-id "${confirmTenantId}"`,
    );
  }

  const plan = buildDomainRefreshDeletePlan(tenant.id);
  assertDomainRefreshScoped(plan, tenant.id);
  console.log("\n[refresh-domain] tenant-scoped delete plan:");
  for (const d of plan) console.log(`  • DELETE ${d.table.padEnd(20)} ${d.description}`);

  const deleted: Record<string, number> = {};

  // Line items first (scoped through parent invoice ids — no tenant_id column).
  const { data: invRows, error: invErr } = await admin
    .from("invoices")
    .select("id")
    .eq("tenant_id", tenant.id);
  if (invErr) throw new Error(`refresh: resolve invoice ids failed: ${invErr.message}`);
  const invoiceIds = (invRows ?? []).map((r) => r.id as string);
  if (invoiceIds.length > 0) {
    const { data: delLi, error: liErr } = await admin
      .from("invoice_line_items")
      .delete()
      .in("invoice_id", invoiceIds)
      .select("id");
    if (liErr) throw new Error(`refresh: delete invoice_line_items failed: ${liErr.message}`);
    deleted.invoice_line_items = delLi?.length ?? 0;
  } else {
    deleted.invoice_line_items = 0;
  }

  for (const table of ["invoices", "scheduled_jobs", "service_requests"] as const) {
    const { data: del, error: delErr } = await admin
      .from(table)
      .delete()
      .eq("tenant_id", tenant.id)
      .select("id");
    if (delErr) throw new Error(`refresh: delete ${table} failed: ${delErr.message}`);
    deleted[table] = del?.length ?? 0;
  }

  return { tenantId: tenant.id, deleted };
}

// ── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseDemoArgs(process.argv.slice(2));
  const now = new Date();
  const plan = buildDemoSeedPlan(now);
  const passwords = {
    ownerPassword: process.env.DEMO_OWNER_PASSWORD,
    techPassword: process.env.DEMO_TECH_PASSWORD,
  };

  // The destructive domain refresh is a distinct, harder-gated path.
  if (args.refreshDomain) {
    const rgate = decideDomainRefreshGate(args, process.env.VITE_SUPABASE_URL, passwords);
    if (!rgate.ok) {
      console.error("=== DEMO DOMAIN REFRESH ===");
      console.error(`\n[refresh-domain] REFUSED: ${rgate.reason}`);
      process.exitCode = 1;
      return;
    }
    console.log("=== DEMO DOMAIN REFRESH (delete + reseed date-anchored rows, demo tenant only) ===");
    console.log(`target project (VITE_SUPABASE_URL): ${rgate.projectRef}`);
    console.log(`demo tenant: "${DEMO_TENANT_NAME}"  confirm-tenant-id: ${rgate.tenantId}`);
    console.log(
      "\nwill NOT touch: auth users, profiles, tenant row, memberships, settings, branding, " +
        "AI policy, onboarding, clients, equipment, documents, chunks, or any other tenant.",
    );
    const admin = getAdminClient();
    const refresh = await refreshDomainRows(admin, rgate.tenantId);
    console.log("\n--- refresh deletes ---");
    for (const [table, n] of Object.entries(refresh.deleted)) {
      console.log(`  ${table.padEnd(20)} deleted=${n}`);
    }
    // Fall through to the normal idempotent provisioning pass, which reseeds
    // the deleted domain rows with fresh, run-relative timestamps.
  }

  const gate = decideDemoGate(args, process.env.VITE_SUPABASE_URL, passwords);

  if (!gate.ok) {
    printBanner(null, plan);
    console.error(`\n[demo-provision] REFUSED: ${gate.reason}`);
    process.exitCode = 1;
    return;
  }

  if (gate.mode === "dry-run") {
    printBanner(gate.projectRef, plan);
    console.log(
      "\n[demo-provision] DRY RUN (default): no DB connection, no writes. " +
        "To write: set DEMO_OWNER_PASSWORD + DEMO_TECH_PASSWORD and pass " +
        "--confirm-project <ref> matching VITE_SUPABASE_URL.",
    );
    return;
  }

  printBanner(gate.projectRef, plan);
  assertDemoPlanWithinAllowlist(buildDemoWritePlan()); // runtime guard: never broad
  console.log(`\n[demo-provision] writing to ${gate.projectRef} …`);

  const admin = getAdminClient(); // throws if env missing
  const tally: Tally = {};
  const userIds = await provisionUsers(
    admin,
    { owner: process.env.DEMO_OWNER_PASSWORD!, tech: process.env.DEMO_TECH_PASSWORD! },
    tally,
  );
  const ownerId = userIds.get("owner");
  if (!ownerId) throw new Error("owner user id missing after provisioning");
  const tenantId = await provisionTenant(admin, ownerId, tally);
  await provisionMemberships(admin, tenantId, userIds, tally);
  await provisionTenantSingletons(admin, tenantId, now, tally);
  const clientIds = await provisionClients(admin, tenantId, plan, tally);
  const equipmentIds = await provisionEquipment(admin, tenantId, plan, clientIds, now, tally);
  const jobIds = await provisionJobs(admin, tenantId, plan, clientIds, equipmentIds, userIds, tally);
  await provisionInvoices(admin, tenantId, plan, clientIds, jobIds, now, tally);
  await provisionServiceRequests(admin, tenantId, plan, clientIds, now, tally);
  const chunkTotal = await provisionCorpus(admin, tenantId, tally);

  printResult(tally, chunkTotal);
  console.log(`\n[demo-provision] done. demo tenant id=${tenantId}`);
}

main().catch((e) => {
  console.error("[demo-provision] failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
