/**
 * Disposable, per-run-namespaced fixtures for the authorization regression spec
 * (PR-TEST-3). Everything is created under a unique `runId` suffix so concurrent
 * runs never collide, and everything is torn down by recorded id. NOTHING here
 * depends on the shared global-setup fixtures, on persistent demo/founder
 * credentials, or on identities surviving another run.
 *
 * NODE CONTEXT ONLY. Uses the service-role admin client (getAdminClient) to seed
 * and inspect — never handed to a browser page.
 */

import { getAdminClient } from './supabase-admin';
import { seedTestDocuments, seedDocumentChunks, seedTenantAIPolicy } from './ai-seed-helpers';

const E2E_MARKER = 'e2e_test_data';

export interface DisposableUser {
  id: string;
  email: string;
}

export interface AuthzFixtures {
  runId: string;
  password: string;
  tenantA: {
    id: string;
    owner: DisposableUser;
    tech: DisposableUser;
    admin: DisposableUser;
    clientId: string;
    invoiceId: string;
    jobId: string;
  };
  tenantB: {
    id: string;
    owner: DisposableUser;
    tech: DisposableUser;
    clientId: string;
    invoiceId: string;
    jobId: string;
    /** Conversation owned by Tenant B (foreign to Tenant A) — Gap 1 fixture. */
    conversationId: string;
  };
  platformAdmin: DisposableUser;
  /** Authenticated user with NO tenant membership. */
  ordinaryUser: DisposableUser;
  betaApplicationId: string;
  // Teardown bookkeeping.
  userIds: string[];
  tenantIds: string[];
}

function makeRunId(): string {
  // Node context — Date.now()/Math.random() are fine here (unlike workflow scripts).
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createUser(email: string, password: string, fullName: string): Promise<DisposableUser> {
  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, [E2E_MARKER]: true },
  });
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message ?? 'no user'}`);
  await admin
    .from('profiles')
    .upsert({ user_id: data.user.id, full_name: fullName, email }, { onConflict: 'user_id' });
  return { id: data.user.id, email };
}

async function createTenant(name: string, slug: string, ownerId: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('tenants')
    .insert({
      name,
      slug,
      industry: 'hvac',
      owner_id: ownerId,
      subscription_tier: 'enterprise', // unlimited AI rate limit
      subscription_status: 'active',
    })
    .select('id')
    .single();
  if (error) throw new Error(`createTenant ${slug}: ${error.message}`);
  return data.id as string;
}

async function addMembership(tenantId: string, userId: string, role: string): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('tenant_users')
    .insert({ tenant_id: tenantId, user_id: userId, role, is_active: true });
  if (error) throw new Error(`addMembership ${role} ${userId}: ${error.message}`);
}

async function createClientRow(tenantId: string, name: string, email: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('clients')
    .insert({ tenant_id: tenantId, name, email })
    .select('id')
    .single();
  if (error) throw new Error(`createClientRow ${name}: ${error.message}`);
  return data.id as string;
}

async function createInvoice(tenantId: string, clientId: string, invoiceNumber: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('invoices')
    .insert({
      tenant_id: tenantId,
      invoice_number: invoiceNumber,
      client_id: clientId,
      status: 'sent',
      subtotal: 150,
      tax_amount: 0,
      total: 150,
      due_date: '2026-08-01',
    })
    .select('id')
    .single();
  if (error) throw new Error(`createInvoice ${invoiceNumber}: ${error.message}`);
  const invoiceId = data.id as string;
  const { error: liErr } = await admin.from('invoice_line_items').insert({
    invoice_id: invoiceId,
    description: 'AuthZ Labor - 2 hours',
    unit_price: 75,
    total: 150,
    quantity: 2,
    item_type: 'labor',
  });
  if (liErr) throw new Error(`createInvoice line item ${invoiceNumber}: ${liErr.message}`);
  return invoiceId;
}

async function createJob(tenantId: string, assignedTo: string, title: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('scheduled_jobs')
    .insert({
      tenant_id: tenantId,
      title,
      status: 'pending',
      priority: 'high',
      job_type: 'Repair',
      assigned_to: assignedTo, // NB: column is assigned_to, not technician_id
    })
    .select('id')
    .single();
  if (error) throw new Error(`createJob ${title}: ${error.message}`);
  return data.id as string;
}

async function createConversation(tenantId: string, userId: string, title: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('conversations')
    .insert({ tenant_id: tenantId, user_id: userId, title })
    .select('id')
    .single();
  if (error) throw new Error(`createConversation ${title}: ${error.message}`);
  return data.id as string;
}

export async function provisionAuthzFixtures(): Promise<AuthzFixtures> {
  const admin = getAdminClient();
  const runId = makeRunId();
  const password = `E2eAuthz-${runId}!X`;
  const em = (label: string) => `authz-${label}-${runId}@fieldtek-test.dev`;
  const userIds: string[] = [];
  const tenantIds: string[] = [];

  // ── Users ──
  const aOwner = await createUser(em('a-owner'), password, 'AuthZ A Owner');
  const aTech = await createUser(em('a-tech'), password, 'AuthZ A Tech');
  const aAdmin = await createUser(em('a-admin'), password, 'AuthZ A Admin');
  const bOwner = await createUser(em('b-owner'), password, 'AuthZ B Owner');
  const bTech = await createUser(em('b-tech'), password, 'AuthZ B Tech');
  const platformAdmin = await createUser(em('platform'), password, 'AuthZ Platform Admin');
  const ordinaryUser = await createUser(em('ordinary'), password, 'AuthZ Ordinary');
  userIds.push(aOwner.id, aTech.id, aAdmin.id, bOwner.id, bTech.id, platformAdmin.id, ordinaryUser.id);

  await admin
    .from('platform_admins')
    .upsert({ user_id: platformAdmin.id, email: platformAdmin.email }, { onConflict: 'user_id' });

  // ── Tenants + memberships ──
  const tenantAId = await createTenant(`AuthZ A ${runId}`, `authz-a-${runId}`, aOwner.id);
  const tenantBId = await createTenant(`AuthZ B ${runId}`, `authz-b-${runId}`, bOwner.id);
  tenantIds.push(tenantAId, tenantBId);

  await addMembership(tenantAId, aOwner.id, 'owner');
  await addMembership(tenantAId, aTech.id, 'technician');
  await addMembership(tenantAId, aAdmin.id, 'admin');
  await addMembership(tenantBId, bOwner.id, 'owner');
  await addMembership(tenantBId, bTech.id, 'technician');

  // ── AI corpus for Tenant A so field-assistant answers grounded (Gap 1) ──
  // Embeddings come from the checked-in fixture (no OpenAI at seed time).
  await seedTenantAIPolicy(tenantAId);
  const docIds = await seedTestDocuments(tenantAId);
  await seedDocumentChunks(tenantAId, docIds);

  // ── Clients + invoices (B1) ──
  const aClientId = await createClientRow(tenantAId, 'AuthZ A Client', em('a-client'));
  const aInvoiceId = await createInvoice(tenantAId, aClientId, `AUTHZ-A-${runId}`);
  const bClientId = await createClientRow(tenantBId, 'AuthZ B Client', em('b-client'));
  const bInvoiceId = await createInvoice(tenantBId, bClientId, `AUTHZ-B-${runId}`);

  // ── Jobs (B2/B4) ──
  const aJobId = await createJob(tenantAId, aTech.id, `AuthZ A Job ${runId}`);
  const bJobId = await createJob(tenantBId, bTech.id, `AuthZ B Job ${runId}`);

  // ── Foreign conversation owned by Tenant B (Gap 1) ──
  const bConversationId = await createConversation(tenantBId, bOwner.id, 'AuthZ foreign conversation');

  // ── Disposable beta application (Gap 2 allow-path) ──
  const { data: beta, error: betaErr } = await admin
    .from('beta_applications')
    .insert({ company_name: `AuthZ Beta ${runId}`, email: em('beta'), status: 'pending' })
    .select('id')
    .single();
  if (betaErr) throw new Error(`create beta_application: ${betaErr.message}`);

  return {
    runId,
    password,
    tenantA: {
      id: tenantAId,
      owner: aOwner,
      tech: aTech,
      admin: aAdmin,
      clientId: aClientId,
      invoiceId: aInvoiceId,
      jobId: aJobId,
    },
    tenantB: {
      id: tenantBId,
      owner: bOwner,
      tech: bTech,
      clientId: bClientId,
      invoiceId: bInvoiceId,
      jobId: bJobId,
      conversationId: bConversationId,
    },
    platformAdmin,
    ordinaryUser,
    betaApplicationId: beta.id as string,
    userIds,
    tenantIds,
  };
}

/**
 * Teardown, strictly by recorded id. Deleting a tenant cascades every
 * tenant-scoped table (tenant_users, clients, invoices→line_items, scheduled_jobs,
 * documents→chunks, conversations→messages, tenant_ai_policies,
 * workflow_step_evidence, …). ai_audit_logs and auth users are not tenant-cascaded,
 * so they are handled explicitly. Returns any residue rather than throwing, so the
 * caller can report exact leftovers.
 */
export async function teardownAuthzFixtures(fx: AuthzFixtures): Promise<{ residue: string[] }> {
  const admin = getAdminClient();
  const residue: string[] = [];

  for (const tenantId of fx.tenantIds) {
    // workflow_step_evidence FK to tenants is NOT ON DELETE CASCADE, and its
    // technician_id references auth.users — so B4's success rows block both the
    // tenant delete and the technician's user delete. Clear it explicitly first.
    const { error: evErr } = await admin
      .from('workflow_step_evidence')
      .delete()
      .eq('tenant_id', tenantId);
    if (evErr) residue.push(`workflow_step_evidence(${tenantId}): ${evErr.message}`);

    const { error } = await admin.from('ai_audit_logs').delete().eq('tenant_id', tenantId);
    if (error) residue.push(`ai_audit_logs(${tenantId}): ${error.message}`);
  }

  {
    const { error } = await admin.from('beta_applications').delete().eq('id', fx.betaApplicationId);
    if (error) residue.push(`beta_applications(${fx.betaApplicationId}): ${error.message}`);
  }

  for (const tenantId of fx.tenantIds) {
    const { error } = await admin.from('tenants').delete().eq('id', tenantId);
    if (error) residue.push(`tenants(${tenantId}): ${error.message}`);
  }

  // platform_admins is keyed by user_id; delete explicitly before removing the user.
  {
    const { error } = await admin.from('platform_admins').delete().eq('user_id', fx.platformAdmin.id);
    if (error) residue.push(`platform_admins(${fx.platformAdmin.id}): ${error.message}`);
  }

  for (const userId of fx.userIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) residue.push(`auth user(${userId}): ${error.message}`);
  }

  return { residue };
}
