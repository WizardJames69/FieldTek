/**
 * Form-engine Slice Zero — direct authorization probes.
 *
 * Same contract as week0-c-rls-probe.mjs (the Week 0 verification-of-record
 * pattern): every denial is paired with a positive control so a pass cannot be
 * a false negative from a broken fixture; fixtures are disposable and
 * per-run-namespaced; teardown runs in `finally`, cleanup is error-checked,
 * and the run asserts zero residue before exiting. This is what makes the
 * Slice Zero RLS surface RE-verifiable rather than reviewed once.
 *
 *   P1  instance SELECT: technician sees own + assigned-job instances, not a
 *       peer's unrelated instance
 *   P2  instance INSERT: only as yourself
 *   P3  instance UPDATE: post-completion analytics edits are staff-only
 *       (technician denied on own completed row; in-progress still writable;
 *       staff edit lands AND leaves a form_instance_revisions audit row)
 *   P4  form_number_counters: no client-role read or write (definer-RPC only)
 *   P5  DELETE on instances and deficiencies: denied even for admins
 *   P6  cross-tenant SELECT on all five form tables: zero rows
 *   P7  form-attachments storage: writes scoped to the caller's tenant folder
 *   P8  complete_form_instance guard: outcome 'complete' + deficiencies is
 *       rejected with the distinguishable 'outcome_deficiency_conflict' error
 *       (and the counter does not advance)
 *
 * Run AFTER the Slice Zero migration is applied to the target project.
 *
 * NODE CONTEXT ONLY — reads the service-role key from .env.test and never
 * hands it to a browser. Run from the repo root:
 *
 *   node scripts/probes/slice-zero-rls-probe.mjs
 *
 * Exit code 0 = every probe passed AND zero residue.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
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
const PASS = `SZ0-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}!`;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const DEFINITION = { schema_version: 1, title: `SZ probe form ${runId}`, nodes: [] };

const results = [];
const rec = (id, pass, detail) => { results.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${detail}`); };

const userIds = [];
const tenantIds = [];
const uploads = [];

async function mkUser(tag) {
  const email = `sz0-${runId}-${tag}@fieldtek-test.dev`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASS, email_confirm: true, user_metadata: { full_name: `SZ0 ${tag}` },
  });
  if (error) throw new Error(`mkUser ${tag}: ${error.message}`);
  userIds.push(data.user.id);
  await admin.from('profiles').upsert({ user_id: data.user.id, full_name: `SZ0 ${tag}`, email }, { onConflict: 'user_id' });
  return { id: data.user.id, email };
}
async function mkTenant(tag, ownerId) {
  const { data, error } = await admin.from('tenants').insert({
    name: `SZ0 ${tag} ${runId}`, slug: `sz0-${runId}-${tag}`, industry: 'hvac',
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
async function mkInstance(as, fields) {
  const id = randomUUID();
  const { error } = await as.from('form_instances').insert({
    id, template_version: 1, definition_snapshot: DEFINITION, answers: {}, ...fields,
  });
  if (error) throw new Error(`mkInstance: ${error.message}`);
  return id;
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
  const techB = await mkUser('techb');
  const ownerB = await mkUser('ownerb');
  const tenantA = await mkTenant('a', adminA.id);
  const tenantB = await mkTenant('b', ownerB.id);
  await member(tenantA, adminA.id, 'admin');
  await member(tenantA, techA.id, 'technician');
  await member(tenantA, techB.id, 'technician');
  await member(tenantB, ownerB.id, 'owner');

  const { data: tplA, error: tplAErr } = await admin.from('form_templates').insert({
    tenant_id: tenantA, source_key: `sz0-${runId}-a`, name: `SZ0 A ${runId}`,
    version: 1, status: 'published', definition: DEFINITION, created_by: adminA.id,
  }).select('id').single();
  if (tplAErr) throw new Error(`template A: ${tplAErr.message}`);
  const { data: tplB, error: tplBErr } = await admin.from('form_templates').insert({
    tenant_id: tenantB, source_key: `sz0-${runId}-b`, name: `SZ0 B ${runId}`,
    version: 1, status: 'published', definition: DEFINITION, created_by: ownerB.id,
  }).select('id').single();
  if (tplBErr) throw new Error(`template B: ${tplBErr.message}`);

  const { data: job, error: jobErr } = await admin.from('scheduled_jobs').insert({
    tenant_id: tenantA, title: `SZ0 probe job ${runId}`, assigned_to: techA.id,
  }).select('id').single();
  if (jobErr) throw new Error(`job: ${jobErr.message}`);

  const asAdminA = await signIn(adminA.email);
  const asTechA = await signIn(techA.email);
  const asTechB = await signIn(techB.email);

  // ---------- P2: instance INSERT only as yourself ----------
  const { error: p2deny } = await asTechA.from('form_instances').insert({
    id: randomUUID(), tenant_id: tenantA, template_id: tplA.id, template_version: 1,
    definition_snapshot: DEFINITION, answers: {}, created_by: techB.id,
  });
  rec('P2-deny  technician INSERT as another user', !!p2deny,
    p2deny ? `${p2deny.code} ${p2deny.message}` : 'INSERT SUCCEEDED — policy hole');

  const instTechAProg = await mkInstance(asTechA, { tenant_id: tenantA, template_id: tplA.id, created_by: techA.id });
  rec('P2-allow technician INSERT as self (control)', true, `inserted ${instTechAProg.slice(0, 8)}`);

  // Remaining fixtures: a to-be-completed instance for techA, techB's
  // instances (one unrelated, one on techA's assigned job), tenant-B rows.
  const instTechADone = await mkInstance(asTechA, { tenant_id: tenantA, template_id: tplA.id, created_by: techA.id });
  const instTechB = await mkInstance(asTechB, { tenant_id: tenantA, template_id: tplA.id, created_by: techB.id });
  const instTechBOnJob = await mkInstance(asTechB, { tenant_id: tenantA, template_id: tplA.id, created_by: techB.id, job_id: job.id });
  const instB = await mkInstance(admin, { tenant_id: tenantB, template_id: tplB.id, created_by: ownerB.id });
  const defB = randomUUID();
  {
    const { error } = await admin.from('form_deficiencies').insert({
      id: defB, tenant_id: tenantB, instance_id: instB, node_id: 'q_probe',
      description: `SZ0 tenant-B deficiency ${runId}`,
    });
    if (error) throw new Error(`deficiency B: ${error.message}`);
  }

  // ---------- P8: RPC contradiction guard ----------
  const defA = randomUUID();
  const { error: p8err } = await asTechA.rpc('complete_form_instance', {
    p_instance_id: instTechADone, p_answers: { q: 'yes' }, p_outcome: 'complete',
    p_fault_category: null, p_responsible_party: null, p_blocker: 'none',
    p_serial_numbers: [], p_labor_hours: null,
    p_deficiencies: [{ id: defA, node_id: 'q_probe', row_id: null, clause: '1.01', description: 'probe deficiency' }],
  });
  rec('P8-deny  outcome complete + deficiencies rejected', !!p8err && String(p8err.message).includes('outcome_deficiency_conflict'),
    p8err ? p8err.message : 'RPC ACCEPTED contradictory submission');
  {
    const { data } = await admin.from('form_instances').select('status, document_number').eq('id', instTechADone).single();
    const { data: ctr } = await admin.from('form_number_counters').select('next_value').eq('tenant_id', tenantA);
    rec('P8-deny  guard left instance untouched, counter unadvanced',
      data?.status === 'in_progress' && data?.document_number === null && (ctr ?? []).length === 0,
      `status=${data?.status} doc=${data?.document_number} counterRows=${(ctr ?? []).length}`);
  }

  // Real completion (positive control for the RPC creator arm + fixture for
  // P3/P5/P6): techA completes with the correct outcome and one deficiency.
  const { data: doneRows, error: doneErr } = await asTechA.rpc('complete_form_instance', {
    p_instance_id: instTechADone, p_answers: { q: 'yes' }, p_outcome: 'complete_with_deficiencies',
    p_fault_category: 'probe-fault', p_responsible_party: 'Probe Mechanical Ltd', p_blocker: 'none',
    p_serial_numbers: ['SZ0SN1'], p_labor_hours: 2.5,
    p_deficiencies: [{ id: defA, node_id: 'q_probe', row_id: null, clause: '1.01', description: 'probe deficiency' }],
  });
  const docNumber = doneRows?.[0]?.document_number ?? null;
  rec('P8-allow creator completes via RPC (control)', !doneErr && !!docNumber,
    doneErr ? doneErr.message : `document_number=${docNumber}`);

  // ---------- P1: instance SELECT lattice ----------
  const { data: p1deny } = await asTechA.from('form_instances').select('id').eq('id', instTechB);
  rec('P1-deny  technician reads peer instance', (p1deny ?? []).length === 0, `${(p1deny ?? []).length} rows returned`);
  const { data: p1own } = await asTechA.from('form_instances').select('id').eq('id', instTechAProg);
  rec('P1-allow technician reads own instance (control)', (p1own ?? []).length === 1, `${(p1own ?? []).length} rows returned`);
  const { data: p1job } = await asTechA.from('form_instances').select('id').eq('id', instTechBOnJob);
  rec('P1-allow technician reads assigned-job instance (control)', (p1job ?? []).length === 1, `${(p1job ?? []).length} rows returned`);

  // ---------- P3: post-completion analytics edits are staff-only ----------
  const { data: p3deny, error: p3denyErr } = await asTechA.from('form_instances')
    .update({ fault_category: 'tech-recat' }).eq('id', instTechADone).select('id');
  rec('P3-deny  technician edits own COMPLETED analytics', !p3denyErr && (p3deny ?? []).length === 0,
    p3denyErr ? `${p3denyErr.code} ${p3denyErr.message}` : `${(p3deny ?? []).length} rows affected`);
  {
    const { data } = await admin.from('form_instances').select('fault_category').eq('id', instTechADone).single();
    rec('P3-deny  completed fault_category unchanged (readback)', data?.fault_category === 'probe-fault', `fault_category=${data?.fault_category}`);
  }
  const { data: p3prog, error: p3progErr } = await asTechA.from('form_instances')
    .update({ answers: { q: 'edited' } }).eq('id', instTechAProg).select('id');
  rec('P3-allow technician edits own IN-PROGRESS instance (control)', !p3progErr && (p3prog ?? []).length === 1,
    p3progErr ? `${p3progErr.code} ${p3progErr.message}` : `${(p3prog ?? []).length} rows affected`);
  const { data: p3staff, error: p3staffErr } = await asAdminA.from('form_instances')
    .update({ fault_category: 'office-recat' }).eq('id', instTechADone).select('id');
  rec('P3-allow admin edits completed analytics (control)', !p3staffErr && (p3staff ?? []).length === 1,
    p3staffErr ? `${p3staffErr.code} ${p3staffErr.message}` : `${(p3staff ?? []).length} rows affected`);
  {
    const { data } = await admin.from('form_instance_revisions').select('changed_by, changes').eq('instance_id', instTechADone);
    const rev = (data ?? []).find((r) => r.changes?.fault_category);
    rec('P3-allow staff edit left a revision audit row', !!rev && rev.changed_by === adminA.id,
      rev ? `changed_by=${String(rev.changed_by).slice(0, 8)} changes=${Object.keys(rev.changes).join(',')}` : 'NO revision row recorded');
  }

  // ---------- P4: counters are definer-only ----------
  const { data: c1, error: c1e } = await asTechA.from('form_number_counters').select('*');
  rec('P4-deny  technician reads counters', !c1e && (c1 ?? []).length === 0,
    c1e ? `${c1e.code} ${c1e.message}` : `${(c1 ?? []).length} rows returned`);
  const { error: c2e } = await asTechA.from('form_number_counters').insert({ tenant_id: tenantA, prefix: 'HAK', next_value: 9999 });
  rec('P4-deny  technician inserts counter row', !!c2e, c2e ? `${c2e.code} ${c2e.message}` : 'INSERT SUCCEEDED — policy hole');
  const { data: c3, error: c3e } = await asAdminA.from('form_number_counters')
    .update({ next_value: 9999 }).eq('tenant_id', tenantA).select('tenant_id');
  rec('P4-deny  admin updates counter', !c3e && (c3 ?? []).length === 0,
    c3e ? `${c3e.code} ${c3e.message}` : `${(c3 ?? []).length} rows affected`);
  {
    const { data } = await admin.from('form_number_counters').select('next_value').eq('tenant_id', tenantA).single();
    rec('P4-allow counter exists with correct value via service role (control)', data?.next_value === 1, `next_value=${data?.next_value}`);
  }

  // ---------- P5: no client-role DELETE on instances/deficiencies ----------
  const { data: d1, error: d1e } = await asAdminA.from('form_instances').delete().eq('id', instTechADone).select('id');
  rec('P5-deny  admin deletes completed instance', !d1e && (d1 ?? []).length === 0,
    d1e ? `${d1e.code} ${d1e.message}` : `${(d1 ?? []).length} rows deleted`);
  const { data: d2, error: d2e } = await asAdminA.from('form_deficiencies').delete().eq('id', defA).select('id');
  rec('P5-deny  admin deletes deficiency', !d2e && (d2 ?? []).length === 0,
    d2e ? `${d2e.code} ${d2e.message}` : `${(d2 ?? []).length} rows deleted`);
  {
    const { data: iLeft } = await admin.from('form_instances').select('id').eq('id', instTechADone);
    const { data: dLeft } = await admin.from('form_deficiencies').select('id').eq('id', defA);
    rec('P5-deny  rows survive (readback control)', (iLeft ?? []).length === 1 && (dLeft ?? []).length === 1,
      `instance=${(iLeft ?? []).length} deficiency=${(dLeft ?? []).length}`);
  }

  // ---------- P6: cross-tenant reads return zero rows on all five tables ----------
  const crossChecks = [
    ['form_templates', (q) => q.eq('tenant_id', tenantB)],
    ['form_instances', (q) => q.eq('tenant_id', tenantB)],
    ['form_deficiencies', (q) => q.eq('tenant_id', tenantB)],
    ['form_number_counters', (q) => q.eq('tenant_id', tenantB)],
    ['form_instance_revisions', (q) => q.eq('tenant_id', tenantB)],
  ];
  for (const [table, scope] of crossChecks) {
    const { data, error } = await scope(asAdminA.from(table).select('tenant_id'));
    rec(`P6-deny  cross-tenant read ${table}`, !error && (data ?? []).length === 0,
      error ? `${error.code} ${error.message}` : `${(data ?? []).length} rows returned`);
  }
  const { data: p6t } = await asAdminA.from('form_templates').select('id').eq('tenant_id', tenantA);
  const { data: p6i } = await asAdminA.from('form_instances').select('id').eq('tenant_id', tenantA);
  const { data: p6d } = await asAdminA.from('form_deficiencies').select('id').eq('tenant_id', tenantA);
  const { data: p6r } = await asAdminA.from('form_instance_revisions').select('id').eq('tenant_id', tenantA);
  rec('P6-allow same-tenant reads return rows (controls)',
    (p6t ?? []).length >= 1 && (p6i ?? []).length >= 1 && (p6d ?? []).length >= 1 && (p6r ?? []).length >= 1,
    `templates=${(p6t ?? []).length} instances=${(p6i ?? []).length} deficiencies=${(p6d ?? []).length} revisions=${(p6r ?? []).length} (counters covered by P4: zero policies for ALL client roles)`);
  const { data: p6techRev } = await asTechA.from('form_instance_revisions').select('id').eq('tenant_id', tenantA);
  rec('P6-deny  technician reads revisions (staff-only surface)', (p6techRev ?? []).length === 0, `${(p6techRev ?? []).length} rows returned`);

  // ---------- P7: form-attachments writes scoped to own tenant folder ----------
  const foreignPath = `${tenantB}/sz0-${runId}/foreign.png`;
  const { error: f1 } = await asAdminA.storage.from('form-attachments').upload(foreignPath, PNG, { contentType: 'image/png' });
  const foreignLanded = await objectExists('form-attachments', foreignPath);
  if (foreignLanded) uploads.push({ bucket: 'form-attachments', path: foreignPath });
  rec('P7-deny  cross-tenant attachment upload', !!f1 && !foreignLanded,
    f1 ? `${f1.message}${foreignLanded ? ' BUT OBJECT LANDED' : ''}` : 'UPLOAD SUCCEEDED — policy hole');
  const ownPath = `${tenantA}/${instTechADone}/probe-${runId}.png`;
  const { error: f2 } = await asTechA.storage.from('form-attachments').upload(ownPath, PNG, { contentType: 'image/png' });
  if (!f2) uploads.push({ bucket: 'form-attachments', path: ownPath });
  rec('P7-allow member uploads to own tenant folder (control)', !f2, f2 ? f2.message : 'uploaded');

  await asTechA.auth.signOut();
  await asTechB.auth.signOut();
  await asAdminA.auth.signOut();
} catch (e) {
  console.error('PROBE ERROR:', e.message);
  results.push({ id: 'harness', pass: false, detail: e.message });
} finally {
  // ---------- teardown (service role; every delete error-checked) ----------
  const cleanupErrors = [];
  const check = (label, error) => { if (error) cleanupErrors.push(`${label}: ${error.message}`); };

  for (const u of uploads) check(`storage ${u.bucket}/${u.path}`, (await admin.storage.from(u.bucket).remove([u.path])).error);
  for (const t of tenantIds) {
    check(`revisions ${t}`, (await admin.from('form_instance_revisions').delete().eq('tenant_id', t)).error);
    check(`deficiencies ${t}`, (await admin.from('form_deficiencies').delete().eq('tenant_id', t)).error);
    check(`instances ${t}`, (await admin.from('form_instances').delete().eq('tenant_id', t)).error);
    check(`counters ${t}`, (await admin.from('form_number_counters').delete().eq('tenant_id', t)).error);
    check(`jobs ${t}`, (await admin.from('scheduled_jobs').delete().eq('tenant_id', t)).error);
    check(`templates ${t}`, (await admin.from('form_templates').delete().eq('tenant_id', t)).error);
    check(`tenant_users ${t}`, (await admin.from('tenant_users').delete().eq('tenant_id', t)).error);
    check(`tenants ${t}`, (await admin.from('tenants').delete().eq('id', t)).error);
  }
  for (const id of userIds) {
    check(`profile ${id}`, (await admin.from('profiles').delete().eq('user_id', id)).error);
    check(`auth user ${id}`, (await admin.auth.admin.deleteUser(id)).error);
  }

  // ---------- residue assertion ----------
  const { data: tLeft } = await admin.from('tenants').select('id')
    .in('id', tenantIds.length ? tenantIds : ['00000000-0000-0000-0000-000000000000']);
  const { data: uLeft } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const staleUsers = (uLeft?.users ?? []).filter((u) => u.email?.startsWith(`sz0-${runId}-`));
  let objectsLeft = 0;
  for (const { bucket, path } of uploads) {
    if (await objectExists(bucket, path)) { objectsLeft += 1; console.log(`RESIDUE OBJECT  ${bucket}/${path}`); }
  }

  for (const e of cleanupErrors) console.log(`CLEANUP ERROR  ${e}`);
  console.log(`\nRESIDUE  tenants=${(tLeft ?? []).length} users=${staleUsers.length} objects=${objectsLeft} cleanupErrors=${cleanupErrors.length}`);
  const residue = (tLeft ?? []).length + staleUsers.length + objectsLeft + cleanupErrors.length;
  const failed = results.filter((r) => !r.pass);
  console.log(`RESULT   ${results.length - failed.length}/${results.length} probes passed${failed.length ? ` — FAILED: ${failed.map((f) => f.id).join(', ')}` : ''}`);
  process.exit(failed.length || residue ? 1 : 0);
}
