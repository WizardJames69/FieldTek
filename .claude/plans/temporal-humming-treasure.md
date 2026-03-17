# Fix: Inline Embedding Pipeline Failing at Runtime

## Context

The inline embedding pipeline in `extract-document-text` was implemented in a previous session (shared chunking module, REST helpers, sequential embedding, `EdgeRuntime.waitUntil`). All code exists and is deployed. However, **embeddings are failing at runtime** — `embedding_status = 'failed'`, 0 chunks created.

The architecture is correct. The code structure is correct. Something inside the embedding IIFE (lines 501-594) is throwing an exception.

## Current State (already implemented — DO NOT recreate)

| Component | Status | File |
|-----------|--------|------|
| `_shared/chunking.ts` | EXISTS (236 lines) | Exports `chunkTextStructured`, `estimateTokens`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSION` |
| REST helpers in extract-document-text | EXISTS (lines 29-74) | `embRestHeaders`, `embRestSelect`, `embRestInsert`, `embRestUpdate`, `embRestDelete` |
| `generateSingleEmbedding` | EXISTS (lines 76-95) | Uses `fetchWithFallback` from `_shared/aiClient.ts` |
| Inline embedding IIFE | EXISTS (lines 501-594) | Sequential loop, 200ms delay, null-out chunks |
| `EdgeRuntime.waitUntil` | EXISTS (line 597) | Registers background task |
| `generate-embeddings` refactored | EXISTS (306 lines) | Imports from `_shared/chunking.ts` |

## Diagnosis

The embedding IIFE at lines 501-594 throws, caught at line 588, sets `embedding_status = 'failed'`. The error is only logged to console (not persisted to DB).

### Bugs Found in Code Audit

**Bug 1: Empty embedding not validated** — [line 94](supabase/functions/extract-document-text/index.ts#L94)
```ts
return data.data?.[0]?.embedding || [];
```
If the OpenAI API returns unexpected data, this returns `[]`. Inserting an empty array into `vector(1536)` column causes a Postgres dimension mismatch error → the entire IIFE throws.

**Bug 2: Error details not persisted** — [lines 588-592](supabase/functions/extract-document-text/index.ts#L588)
```ts
} catch (embErr) {
  console.error(..., embErr);
  try {
    await embRestUpdate("documents", `id=eq.${documentId}`, { embedding_status: "failed" });
  } catch (_) { /* ignore */ }
}
```
The actual error message is lost — only goes to console logs. The `documents.last_error` column (added by migration `20260301000000`) is never populated, making debugging impossible.

**Bug 3: Early return blocks embedding retry** — [lines 396-398](supabase/functions/extract-document-text/index.ts#L396)
```ts
if (doc.extraction_status === "completed") {
  return jsonResponse({ success: true, status: "already_extracted" });
}
```
Re-calling `extract-document-text` on a document with `extraction_status = 'completed'` returns early. Even if `embedding_status = 'failed'`, there's no way to retry embeddings through this function.

**Bug 4: `EdgeRuntime.waitUntil` uses optional chaining** — [line 597](supabase/functions/extract-document-text/index.ts#L597)
```ts
(globalThis as any).EdgeRuntime?.waitUntil?.(embeddingPromise);
```
If `EdgeRuntime` is undefined, the promise floats unattached and gets GC'd when the function returns. Silent failure with no warning.

**Bug 5: Chunk safety guard missing** — `chunkTextStructured` has no upper bound on chunk count. An extremely large document could produce 500+ chunks, overwhelming the 400s wall clock.

## Fix Plan

### Fix 1: Validate embedding response (prevent dimension mismatch)

**File:** `supabase/functions/extract-document-text/index.ts` lines 93-94

```ts
// Replace:
return data.data?.[0]?.embedding || [];

// With:
const embedding = data.data?.[0]?.embedding;
if (!embedding || !Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSION) {
  throw new Error(`Invalid embedding: expected ${EMBEDDING_DIMENSION}d vector, got ${embedding?.length ?? 0}d`);
}
return embedding;
```

### Fix 2: Persist error details to `last_error` column

**File:** `supabase/functions/extract-document-text/index.ts` lines 588-592

```ts
} catch (embErr) {
  const errMsg = embErr instanceof Error ? embErr.message : String(embErr);
  console.error(`[extract-document-text] [correlation_id=${correlationId}] Inline embedding failed:`, errMsg);
  try {
    await embRestUpdate("documents", `id=eq.${documentId}`, {
      embedding_status: "failed",
      last_error: errMsg.substring(0, 500),
    });
  } catch (_) { /* ignore */ }
}
```

### Fix 3: Add embedding recovery for already-extracted documents

**File:** `supabase/functions/extract-document-text/index.ts` lines 395-398

Extract the embedding IIFE into a helper function `runInlineEmbedding(documentId, text, correlationId)`, then call it from the early-return path when `embedding_status` is `pending` or `failed`:

```ts
if (doc.extraction_status === "completed") {
  const needsEmbedding = !doc.embedding_status ||
    doc.embedding_status === "pending" ||
    doc.embedding_status === "failed";

  if (needsEmbedding) {
    // Add embedding_status to the SELECT at line 384
    const { data: fullDoc } = await supabaseAdmin
      .from("documents")
      .select("extracted_text")
      .eq("id", documentId)
      .single();

    if (fullDoc?.extracted_text) {
      const embPromise = runInlineEmbedding(documentId, fullDoc.extracted_text, correlationId);
      const wuFn = (globalThis as any).EdgeRuntime?.waitUntil;
      if (wuFn) {
        wuFn.call((globalThis as any).EdgeRuntime, embPromise);
      } else {
        await embPromise;
      }
    }
  }

  return jsonResponse({ success: true, status: "already_extracted" });
}
```

This also requires adding `embedding_status` to the SELECT at line 384:
```ts
.select("file_url, file_type, extraction_status, embedding_status, name")
```

### Fix 4: Safe `EdgeRuntime.waitUntil` with fallback

**File:** `supabase/functions/extract-document-text/index.ts` line 597

```ts
const wuFn = (globalThis as any).EdgeRuntime?.waitUntil;
if (wuFn) {
  wuFn.call((globalThis as any).EdgeRuntime, embeddingPromise);
} else {
  console.warn("[extract-document-text] EdgeRuntime.waitUntil unavailable, awaiting inline");
  await embeddingPromise;
}
```

### Fix 5: Add chunk count safety guard

**File:** `supabase/functions/_shared/chunking.ts` — inside `chunkTextStructured`, before return

```ts
if (result.length > 500) {
  console.warn(`[chunking] Truncating ${result.length} chunks to 500`);
  result.length = 500;
}
```

### Fix 6: Apply same embedding validation in generate-embeddings

**File:** `supabase/functions/generate-embeddings/index.ts` — same fix as Fix 1 in its `generateSingleEmbedding`

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/extract-document-text/index.ts` | Fixes 1-4: validate embedding, persist errors, recovery path, safe waitUntil |
| `supabase/functions/_shared/chunking.ts` | Fix 5: chunk count guard |
| `supabase/functions/generate-embeddings/index.ts` | Fix 6: validate embedding response |

## Verification

1. Deploy: `supabase functions deploy extract-document-text --project-ref fgemfxhwushaiiguqxfe`
2. Deploy: `supabase functions deploy generate-embeddings --project-ref fgemfxhwushaiiguqxfe`
3. Re-trigger failed document: call `extract-document-text` with `{ documentId: "<JET17-id>", mode: "document" }` — early-return path should now detect `failed` status and re-run embeddings
4. Check DB:
   ```sql
   SELECT embedding_status, last_error FROM documents WHERE name LIKE 'JET17%';
   SELECT COUNT(*) FROM document_chunks dc JOIN documents d ON d.id = dc.document_id WHERE d.name LIKE 'JET17%';
   ```
5. Upload a fresh PDF — verify end-to-end extraction + embedding
6. Run: `npm test`
