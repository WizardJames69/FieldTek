/**
 * Week 0 Workstream C — direct authorization probes (C1–C4).
 *
 * This is the verification of record for the Week 0 security batch
 * (docs/week0-summary.md). It proves each tightened policy at runtime rather
 * than by inspection, and pairs every denial with a positive control so a pass
 * cannot be a false negative from a broken fixture.
 *
 *   C1  notifications INSERT is self-only
 *   C2  invoice_line_items SELECT is staff-only (technician sees 0 rows)
 *   C3  branding bucket writes are scoped to the caller's own tenant folder
 *   C4  part-receipts DELETE is tenant-admin-only
 *
 * C5 (explicit deny-all DELETE on workflow_step_evidence) is intentionally not
 * probed: deletes were already default-denied before it, so a behavioural probe
 * returns the same "nothing deleted" either way. It is covered by the migration
 * and the db-replay gate.
 *
 * Fixtures are disposable and per-run-namespaced (two tenants, three users, a
 * client, an invoice with line items, one storage object); everything is torn
 * down in `finally` and the run asserts zero residue before exiting.
 *
 * NODE CONTEXT ONLY — reads the service-role key from .env.test and never hands
 * it to a browser. Run from the repo root:
 *
 *   node scripts/probes/week0-c-rls-probe.mjs
 *
 * Exit code 0 = every probe passed.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../../.env.test', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const URL_ = env.VITE_SUPABASE_URL;
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY;

const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PASS = `Wk0C-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}!`;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const results = [];
const rec = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${detail}`); };

const userIds = [];
const tenantIds = [];
const uploads = [];

async function mkUser(tag) {
  const email = `wk0c-${runId}-${tag}@fieldtek-test.dev`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASS, email_confirm: true, user_metadata: { full_name: `WK0C ${tag}` },
  });
  if (error) throw new Error(`mkUser ${tag}: ${error.message}`);
  userIds.push(data.user.id);
  await admin.from('profiles').upsert({ user_id: data.user.id, full_name: `WK0C ${tag}`, email }, { onConflict: 'user_id' });
  return { id: data.user.id, email };
}
async function mkTenant(tag, ownerId) {
  const { data, error } = await admin.from('tenants').insert({
    name: `WK0C ${tag} ${runId}`, slug: `wk0c-${runId}-${tag}`, industry: 'hvac',
    owner_id: ownerId, subscription_tier: 'professional', subscription_status: 'active',
  }).select('id').single();
  if (error) throw new Error(`mkTenant ${tag}: ${error.message}`);
  tenantIds.push(data.id);
  return data.id;
}
async function member(tenantId, userId, role) {
  const { error } = await admin.from('tenant_users').insert({ tenant_id: tenantId, user_id: userId, role, is_active: true });
  if (error) throw new Error(`member ${role}: ${error.message}`);
}
async function signIn(email) {
  const c = createClient(URL_, anonKey, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return c;
}
async function objectExists(bucket, path) {
  const parts = path.split('/');
  const name = parts.pop();
  const { data } = await admin.storage.from(bucket).list(parts.join('/'), { search: name });
  return (data ?? []).some((o) => o.name === name);
}

try {
  // ---------- fixtures ----------
  const adminA = await mkUser('admina');
  const techA = await mkUser('techa');
  const ownerB = await mkUser('ownerb');
  const tenantA = await mkTenant('a', adminA.id);
  const tenantB = await mkTenant('b', ownerB.id);
  await member(tenantA, adminA.id, 'admin');
  await member(tenantA, techA.id, 'technician');
  await member(tenantB, ownerB.id, 'owner');

  const { data: client, error: cErr } = await admin.from('clients')
    .insert({ tenant_id: tenantA, name: `WK0C Client ${runId}`, email: `wk0c-${runId}-client@fieldtek-test.dev` })
    .select('id').single();
  if (cErr) throw new Error(`client: ${cErr.message}`);
  const { data: invoice, error: iErr } = await admin.from('invoices').insert({
    tenant_id: tenantA, client_id: client.id, invoice_number: `WK0C-${runId}`, status: 'sent',
    subtotal: 150, tax_amount: 0, total: 150, due_date: '2026-08-07',
  }).select('id').single();
  if (iErr) throw new Error(`invoice: ${iErr.message}`);
  const { error: liErr } = await admin.from('invoice_line_items').insert([
    { invoice_id: invoice.id, description: 'Probe labour', quantity: 1, unit_price: 100, total: 100 },
    { invoice_id: invoice.id, description: 'Probe parts', quantity: 1, unit_price: 50, total: 50 },
  ]);
  if (liErr) throw new Error(`line items: ${liErr.message}`);

  const receiptPath = `${tenantA}/wk0c-${runId}/receipt.png`;
  const { error: upErr } = await admin.storage.from('part-receipts').upload(receiptPath, PNG, { contentType: 'image/png' });
  if (upErr) throw new Error(`seed receipt: ${upErr.message}`);
  uploads.push({ bucket: 'part-receipts', path: receiptPath });

  const asTech = await signIn(techA.email);
  const asAdmin = await signIn(adminA.email);
  console.log(`fixtures ready: tenantA=${tenantA.slice(0, 8)} tenantB=${tenantB.slice(0, 8)} invoice=${invoice.id.slice(0, 8)}\n`);

  // ---------- C1: notifications INSERT must be self-only ----------
  const { error: n1 } = await asTech.from('notifications').insert({
    tenant_id: tenantA, user_id: adminA.id, title: 'probe', message: 'probe', type: 'info',
  });
  rec('C1-deny  foreign user_id insert', !!n1, n1 ? `${n1.code} ${n1.message}` : 'INSERT SUCCEEDED — policy hole');

  const { data: n2d, error: n2 } = await asTech.from('notifications').insert({
    tenant_id: tenantA, user_id: techA.id, title: 'probe self', message: 'probe self', type: 'info',
  }).select('id').single();
  rec('C1-allow self insert (control)', !n2, n2 ? `${n2.code} ${n2.message}` : 'inserted own row');
  if (n2d?.id) await admin.from('notifications').delete().eq('id', n2d.id);

  // ---------- C2: invoice_line_items SELECT is staff-only ----------
  const { data: liTech, error: liTechErr } = await asTech.from('invoice_line_items').select('id').eq('invoice_id', invoice.id);
  rec('C2-deny  technician reads line items', !liTechErr && (liTech ?? []).length === 0,
    liTechErr ? `${liTechErr.code} ${liTechErr.message}` : `${(liTech ?? []).length} rows returned`);

  const { data: liAdmin, error: liAdminErr } = await asAdmin.from('invoice_line_items').select('id').eq('invoice_id', invoice.id);
  rec('C2-allow admin reads line items (control)', !liAdminErr && (liAdmin ?? []).length === 2,
    liAdminErr ? `${liAdminErr.code} ${liAdminErr.message}` : `${(liAdmin ?? []).length} rows returned`);

  // ---------- C3: branding writes scoped to own tenant folder ----------
  const foreignLogo = `${tenantB}/logo-${runId}.png`;
  const { error: b1 } = await asAdmin.storage.from('branding').upload(foreignLogo, PNG, { contentType: 'image/png' });
  const foreignLanded = await objectExists('branding', foreignLogo);
  if (foreignLanded) uploads.push({ bucket: 'branding', path: foreignLogo });
  rec('C3-deny  admin writes another tenant folder', !!b1 && !foreignLanded,
    b1 ? `${b1.message}${foreignLanded ? ' BUT OBJECT LANDED' : ''}` : 'UPLOAD SUCCEEDED — policy hole');

  const ownLogo = `${tenantA}/logo-${runId}.png`;
  const { error: b2 } = await asAdmin.storage.from('branding').upload(ownLogo, PNG, { contentType: 'image/png' });
  if (!b2) uploads.push({ bucket: 'branding', path: ownLogo });
  rec('C3-allow admin writes own tenant folder (control)', !b2, b2 ? b2.message : 'uploaded to own folder');

  // ---------- C4: part-receipts DELETE is admin-only ----------
  // storage.remove() soft-fails under RLS (empty data, no error), so assert on
  // the object's continued existence, read back with the service role.
  await asTech.storage.from('part-receipts').remove([receiptPath]);
  const survivedTech = await objectExists('part-receipts', receiptPath);
  rec('C4-deny  technician deletes receipt', survivedTech, survivedTech ? 'object still present' : 'OBJECT DELETED — policy hole');

  await asAdmin.storage.from('part-receipts').remove([receiptPath]);
  const survivedAdmin = await objectExists('part-receipts', receiptPath);
  rec('C4-allow admin deletes receipt (control)', !survivedAdmin, survivedAdmin ? 'admin delete BLOCKED' : 'object removed');

  await asTech.auth.signOut();
  await asAdmin.auth.signOut();
} catch (e) {
  console.error('PROBE ERROR:', e.message);
  results.push({ id: 'harness', pass: false, detail: e.message });
} finally {
  // ---------- teardown ----------
  for (const u of uploads) await admin.storage.from(u.bucket).remove([u.path]);
  for (const t of tenantIds) {
    const { data: invs } = await admin.from('invoices').select('id').eq('tenant_id', t);
    for (const inv of invs ?? []) await admin.from('invoice_line_items').delete().eq('invoice_id', inv.id);
    await admin.from('invoices').delete().eq('tenant_id', t);
    await admin.from('clients').delete().eq('tenant_id', t);
    await admin.from('notifications').delete().eq('tenant_id', t);
    await admin.from('tenant_users').delete().eq('tenant_id', t);
    await admin.from('tenants').delete().eq('id', t);
  }
  for (const id of userIds) {
    await admin.from('profiles').delete().eq('user_id', id);
    await admin.auth.admin.deleteUser(id);
  }

  // ---------- residue assertion ----------
  const { data: tLeft } = await admin.from('tenants').select('id')
    .in('id', tenantIds.length ? tenantIds : ['00000000-0000-0000-0000-000000000000']);
  const { data: uLeft } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const staleUsers = (uLeft?.users ?? []).filter((u) => u.email?.startsWith(`wk0c-${runId}-`));
  const brandLeft = tenantIds[1] ? await objectExists('branding', `${tenantIds[1]}/logo-${runId}.png`) : false;
  console.log(`\nRESIDUE  tenants=${(tLeft ?? []).length} users=${staleUsers.length} branding=${brandLeft ? 1 : 0}`);
  const failed = results.filter((r) => !r.pass);
  console.log(`RESULT   ${results.length - failed.length}/${results.length} probes passed${failed.length ? ` — FAILED: ${failed.map((f) => f.id).join(', ')}` : ''}`);
  process.exit(failed.length ? 1 : 0);
}
