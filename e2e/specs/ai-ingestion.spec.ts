/**
 * AI Ingestion E2E
 * ─────────────────
 * Exercises the real upload → extract → chunk → embed → reconcile pipeline
 * end-to-end against staging. Most other AI specs seed `documents` rows
 * directly with `extraction_status='completed'` to bypass the edge functions —
 * this spec instead drives the actual `extract-document-text` edge function so
 * we catch regressions in the ingestion pipeline itself (status flips,
 * chunk-count reconciliation, page metadata propagation, failure surface).
 *
 * Fixtures are constructed in-memory so the suite has no binary deps. The
 * "happy path" PDF is printed by Chromium (page.pdf) from two-page HTML so
 * its text layer is standards-compliant — a hand-rolled minimal PDF parses
 * in local pdfjs but not in the edge runtime's build, which silently routes
 * it to the vision fallback. The "bad" PDF is a short non-PDF payload.
 */
import { test, expect } from '@playwright/test';
import { getAdminClient } from '../helpers/supabase-admin';
import { TEST_TENANT, TEST_USERS } from '../helpers/test-data';

// Combined raw text must exceed extract-document-text's
// MIN_LOCAL_TEXT_LENGTH (200 chars) or the function decides the PDF is
// scanned and routes it to the vision fallback — which never emits
// [[PAGE:N]] markers, so the page_number assertion below would fail.
const HAPPY_PAGES = [
  'FIELDTEK INSTALLATION GUIDE PAGE ONE WIDGET 12345 MOUNT THE CONDENSER UNIT ON A LEVEL PAD AND VERIFY CLEARANCE OF 24 INCHES ON ALL SIDES BEFORE CONNECTING THE LINE SET TORQUE ALL FLARE FITTINGS TO SPECIFICATION AND PRESSURE TEST WITH DRY NITROGEN',
  'FIELDTEK INSTALLATION GUIDE PAGE TWO TORQUE 47 NM EVACUATE THE SYSTEM TO 500 MICRONS AND HOLD FOR 15 MINUTES BEFORE RELEASING THE CHARGE RECORD SUBCOOLING AND SUPERHEAT READINGS ON THE COMMISSIONING SHEET AND ATTACH IT TO THE WORK ORDER',
];

// ── Helpers ──────────────────────────────────────────────────────
async function getTestTenantId(): Promise<string> {
  const client = getAdminClient();
  const { data, error } = await client
    .from('tenants')
    .select('id')
    .eq('name', TEST_TENANT.name)
    .single();
  if (error || !data) throw new Error(`Test tenant "${TEST_TENANT.name}" not found: ${error?.message}`);
  return data.id;
}

async function uploadAndInvoke(opts: {
  tenantId: string;
  fileName: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<string> {
  const client = getAdminClient();
  const path = `${opts.tenantId}/${Date.now()}-${crypto.randomUUID()}-${opts.fileName}`;

  const { error: storageErr } = await client.storage
    .from('documents')
    .upload(path, opts.bytes, { contentType: opts.mimeType, upsert: false });
  if (storageErr) throw new Error(`Storage upload failed: ${storageErr.message}`);

  const { data: docRow, error: insertErr } = await client
    .from('documents')
    .insert({
      tenant_id: opts.tenantId,
      name: opts.fileName,
      category: 'Manual',
      file_url: path,
      file_type: opts.mimeType,
      file_size: opts.bytes.length,
      extraction_status: 'pending',
    })
    .select('id')
    .single();
  if (insertErr || !docRow) throw new Error(`Document insert failed: ${insertErr?.message}`);

  // Invoke the edge function as the seeded tenant admin — the same auth
  // path the real upload dialog uses. (A raw service-role bearer is NOT
  // equal to the SUPABASE_SERVICE_ROLE_KEY the runtime injects on this
  // project, so the function's exact-match bypass 401s it.) The response
  // is checked so an invocation failure surfaces immediately instead of
  // as an opaque poll timeout. Extraction is synchronous in the response;
  // embedding continues via EdgeRuntime.waitUntil.
  const authToken = await getUserAccessToken();
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/extract-document-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ documentId: docRow.id, mode: 'document' }),
  });
  // The failure-path fixture legitimately returns a non-2xx with
  // { success:false, error } after writing extraction_status='failed' —
  // only auth/transport-level failures are fatal here.
  if (resp.status === 401 || resp.status === 403) {
    throw new Error(
      `extract-document-text auth failed (${resp.status}): ${await resp.text()}`,
    );
  }

  return docRow.id;
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? '';
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

let cachedAccessToken: string | null = null;
async function getUserAccessToken(): Promise<string> {
  if (cachedAccessToken) return cachedAccessToken;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    }),
  });
  if (!res.ok) {
    throw new Error(`Auth failed for ${TEST_USERS.admin.email}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  cachedAccessToken = data.access_token as string;
  return cachedAccessToken;
}

async function pollUntilTerminal(
  documentId: string,
  timeoutMs: number,
): Promise<{ extraction_status: string; embedding_status: string | null; last_error: string | null }> {
  const client = getAdminClient();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await client
      .from('documents')
      .select('extraction_status, embedding_status, last_error')
      .eq('id', documentId)
      .single();
    if (data) {
      const ext = data.extraction_status;
      const emb = data.embedding_status;
      const extTerminal = ext === 'completed' || ext === 'failed';
      const embTerminal = emb === 'completed' || emb === 'failed';
      // Extraction failure is terminal even if embedding never started
      if (ext === 'failed') return data as never;
      if (extTerminal && embTerminal) return data as never;
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(`Document ${documentId} did not reach terminal state within ${timeoutMs}ms`);
}

async function cleanupDocument(documentId: string) {
  const client = getAdminClient();
  // Read the file_url so we can also delete from storage
  const { data: doc } = await client
    .from('documents')
    .select('file_url')
    .eq('id', documentId)
    .single();
  await client.from('document_chunks').delete().eq('document_id', documentId);
  await client.from('documents').delete().eq('id', documentId);
  if (doc?.file_url) {
    await client.storage.from('documents').remove([doc.file_url]).catch(() => {});
  }
}

// ── Tests ────────────────────────────────────────────────────────

test.describe('AI Ingestion Pipeline', () => {
  // The full extract → chunk → embed loop can take a while on a cold start.
  test.setTimeout(180_000);

  test('happy path: upload PDF → extract → embed → chunks have page_number', async ({ page }) => {
    const tenantId = await getTestTenantId();
    // Generate the fixture with Chromium's PDF renderer: a hand-rolled
    // minimal PDF parses in local pdfjs but the edge runtime's pdfjs build
    // fails to extract its text layer, silently routing it to the vision
    // fallback (which never emits [[PAGE:N]] markers). A print-to-PDF
    // document has a standards-compliant text layer on both pages.
    await page.setContent(
      `<html><body style="font-family: Helvetica; font-size: 14px;">` +
        `<div style="page-break-after: always;">${HAPPY_PAGES[0]}</div>` +
        `<div>${HAPPY_PAGES[1]}</div>` +
        `</body></html>`,
    );
    const pdfBytes = await page.pdf({ format: 'Letter' });
    const documentId = await uploadAndInvoke({
      tenantId,
      fileName: `e2e-ingestion-happy-${Date.now()}.pdf`,
      bytes: pdfBytes,
      mimeType: 'application/pdf',
    });

    try {
      const final = await pollUntilTerminal(documentId, 150_000);
      expect(final.extraction_status).toBe('completed');
      expect(final.embedding_status).toBe('completed');

      const client = getAdminClient();
      const { data: chunks } = await client
        .from('document_chunks')
        .select('id, embedding, page_number, section_name, chunk_text')
        .eq('document_id', documentId);

      expect(chunks?.length ?? 0).toBeGreaterThan(0);
      // Every chunk must have an embedding vector
      for (const chunk of chunks ?? []) {
        expect(chunk.embedding).toBeTruthy();
      }
      // Diagnostic: which extraction path ran? Local extraction leaves
      // [[PAGE:N]] markers in extracted_text (they are stripped in the
      // chunker, not the extractor); the vision fallback has none.
      const { data: docRow } = await client
        .from('documents')
        .select('extracted_text')
        .eq('id', documentId)
        .single();
      console.log(
        '[diagnostic] extracted_text head:',
        JSON.stringify((docRow?.extracted_text ?? '').slice(0, 120)),
      );
      console.log(
        '[diagnostic] chunk pages:',
        (chunks ?? []).map((c) => `${c.page_number}/${c.section_name}`).join(', '),
      );
      // At least one chunk must carry page_number — proves marker → chunker
      // → DB plumbing is intact for new ingestions.
      const withPage = (chunks ?? []).filter((c) => c.page_number !== null);
      expect(withPage.length).toBeGreaterThan(0);
    } finally {
      await cleanupDocument(documentId);
    }
  });

  test('failure path: corrupted PDF → extraction_status=failed, last_error populated', async () => {
    const tenantId = await getTestTenantId();
    const documentId = await uploadAndInvoke({
      tenantId,
      fileName: `e2e-ingestion-bad-${Date.now()}.pdf`,
      bytes: Buffer.from('not-a-real-pdf'),
      mimeType: 'application/pdf',
    });

    try {
      const final = await pollUntilTerminal(documentId, 60_000);
      expect(final.extraction_status).toBe('failed');
      expect(final.last_error).toBeTruthy();

      // No chunks should have been inserted for a failed extraction
      const client = getAdminClient();
      const { data: chunks } = await client
        .from('document_chunks')
        .select('id')
        .eq('document_id', documentId);
      expect(chunks?.length ?? 0).toBe(0);
    } finally {
      await cleanupDocument(documentId);
    }
  });
});
