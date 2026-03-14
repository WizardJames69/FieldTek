import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as encodeBase64, decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import OpenAI from "https://esm.sh/openai@4.96.0";
import { extractText as extractPdfText } from "npm:unpdf";
import { fetchWithFallback } from "../_shared/aiClient.ts";
import { chunkTextStructured, estimateTokens, EMBEDDING_MODEL, EMBEDDING_DIMENSION } from "../_shared/chunking.ts";

// ── Constants ───────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_EXTRACTED_TEXT_LENGTH = 100000;
const MAX_BASE64_LENGTH = 20 * 1024 * 1024; // ~15MB file after base64 inflation

const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const SUPPORTED_PDF_TYPES = ["application/pdf"];

// ── Embedding REST helpers (raw fetch, no supabase-js) ──────
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function embRestHeaders(prefer = "return=minimal"): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "apikey": SUPA_SERVICE_KEY,
    "Authorization": `Bearer ${SUPA_SERVICE_KEY}`,
    "Prefer": prefer,
  };
}

async function embRestSelect<T>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, {
    headers: embRestHeaders("return=representation"),
  });
  if (!res.ok) throw new Error(`REST select ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function embRestInsert(table: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: embRestHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`REST insert ${table}: ${res.status} ${await res.text()}`);
}

async function embRestUpdate(table: string, query: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: embRestHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`REST update ${table}: ${res.status} ${await res.text()}`);
}

async function embRestDelete(table: string, query: string): Promise<void> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: embRestHeaders(),
  });
  if (!res.ok) throw new Error(`REST delete ${table}: ${res.status} ${await res.text()}`);
}

async function generateSingleEmbedding(text: string, apiKey: string, correlationId?: string): Promise<number[]> {
  const { response, gatewayUsed } = await fetchWithFallback(
    "/embeddings",
    { model: EMBEDDING_MODEL, input: text, dimensions: EMBEDDING_DIMENSION },
    apiKey,
    correlationId,
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Embedding failed (${gatewayUsed}):`, response.status, errorText);
    if (response.status === 429) throw new Error("Rate limit exceeded");
    if (response.status === 402) throw new Error("AI credits exhausted");
    throw new Error(`Embedding failed: ${response.status}`);
  }
  if (gatewayUsed === "fallback") {
    console.warn(`[extract-document-text] Used fallback gateway for embedding`);
  }
  const data = await response.json();
  return data.data?.[0]?.embedding || [];
}

// ── Prompts ─────────────────────────────────────────────────
const RECEIPT_PROMPT = `You are a receipt OCR specialist. Extract part/product details from this receipt.

Return ONLY a JSON object with these fields (use null for missing values):
- parts: array of items found, each with:
  - name: product/part name
  - quantity: number (default 1)
  - unit_cost: number (price per unit)
  - part_number: SKU/item number if visible
- supplier: store name
- total: total amount on receipt

Example response:
{
  "parts": [
    {"name": "3/4 Copper Elbow", "quantity": 2, "unit_cost": 3.49, "part_number": "SKU123456"},
    {"name": "1/2 PVC Pipe 10ft", "quantity": 1, "unit_cost": 8.99, "part_number": null}
  ],
  "supplier": "Home Depot",
  "total": 15.97
}

If you cannot read the receipt clearly, return: {"error": "Could not read receipt", "parts": []}`;

const DOCUMENT_PROMPT = `You are a technical document extraction specialist. Extract ALL text content from the provided document.

CRITICAL REQUIREMENTS:
1. Extract EVERY piece of text visible in the document
2. Preserve document structure: headings, sections, lists, tables
3. Include ALL technical specifications: temperatures, pressures, voltages, part numbers, model numbers
4. Include ALL procedures with step numbers preserved
5. Include ALL warnings, cautions, and safety information
6. Include ALL diagram labels and callouts
7. Format tables in a clear, readable way
8. Include page numbers or section references when visible

OUTPUT FORMAT:
- Return ONLY the extracted text
- Use clear formatting with headers and sections
- Do not add commentary or descriptions
- Do not summarize - extract everything`;

// ── Prompt injection detection ──────────────────────────────
const DOCUMENT_INJECTION_PATTERNS = [
  /ignore\s+(previous|all|any|above|prior)\s+(instructions?|prompts?|rules?|guidelines?)/gi,
  /disregard\s+(previous|all|any|above|prior)\s+(instructions?|prompts?|rules?|guidelines?)/gi,
  /forget\s+(everything|all|what)\s+(you\s+)?(know|learned|were\s+told)/gi,
  /you\s+are\s+now\s+(a|an)\s+(different|new|unrestricted)/gi,
  /pretend\s+(you\s+)?(are|to\s+be)\s+(a|an|unrestricted|jailbroken)/gi,
  /act\s+as\s+(if|though)\s+you\s+(don't|do\s+not)\s+have\s+(any\s+)?restrictions/gi,
  /system\s*prompt\s*(is|:|shows?|says?|reveals?)/gi,
  /reveal\s+(your|the|system)\s+(prompt|instructions?|rules?)/gi,
  /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|system\|>/gi,
  /IMPORTANT:\s*override|NEW\s+INSTRUCTIONS?:/gi,
  /jailbreak|DAN\s+mode|evil\s+mode|bypass\s+(safety|restrictions?|filters?)/gi,
  /override\s+all|you\s+must\s+comply|you\s+have\s+no\s+choice/gi,
];

// ── Clients ─────────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
});

// ── Helpers ─────────────────────────────────────────────────
function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeExtractedText(text: string): {
  sanitized: string;
  injectionDetected: boolean;
} {
  let sanitized = text;
  let injectionDetected = false;

  // Strip control characters (except newlines, tabs, carriage returns)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Strip Unicode bidirectional override characters (text confusion attacks)
  sanitized = sanitized.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");

  // Detect and redact prompt injection patterns
  for (const pattern of DOCUMENT_INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(sanitized)) {
      injectionDetected = true;
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, "[REDACTED-SUSPICIOUS-CONTENT]");
    }
  }

  return { sanitized, injectionDetected };
}

function parseReceiptJson(rawText: string): Record<string, unknown> {
  try {
    const jsonMatch =
      rawText.match(/```json\s*([\s\S]*?)\s*```/) ||
      rawText.match(/```\s*([\s\S]*?)\s*```/) ||
      [null, rawText];
    const jsonStr = (jsonMatch[1] || rawText).trim();
    return JSON.parse(jsonStr);
  } catch {
    console.error("[extract-document-text] Failed to parse receipt JSON:", rawText.substring(0, 200));
    return { error: "Could not parse receipt data", parts: [] };
  }
}

// ── Image extraction ────────────────────────────────────────
async function extractTextFromImage(
  base64Data: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const dataUri = `data:${mimeType};base64,${base64Data}`;

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    instructions: prompt,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: dataUri },
        ],
      },
    ],
  });

  const text = response.output_text;
  if (!text || text.length < 3) {
    throw new Error("Insufficient text extracted from image");
  }
  return text.trim();
}

// ── Local PDF text extraction (no API call) ─────────────────
const MIN_LOCAL_TEXT_LENGTH = 200; // chars — below this, assume scanned/image PDF

async function extractTextFromPDFLocal(base64Data: string): Promise<string | null> {
  try {
    const pdfBytes = decodeBase64(base64Data);
    const { text, totalPages } = await extractPdfText(pdfBytes);
    const fullText = Array.isArray(text) ? text.join("\n") : text;

    console.log(`[extract-document-text] Local PDF extraction: ${fullText.length} chars, ${totalPages} pages`);

    if (fullText && fullText.trim().length >= MIN_LOCAL_TEXT_LENGTH) {
      return fullText.trim();
    }

    // Too little text — likely a scanned/image PDF
    return null;
  } catch (err) {
    console.warn("[extract-document-text] Local PDF extraction failed, falling back to OpenAI:", err);
    return null;
  }
}

// ── PDF extraction (OpenAI vision fallback) ─────────────────
async function extractTextFromPDF(
  base64Data: string,
  fileName: string,
  prompt: string
): Promise<string> {
  const dataUri = `data:application/pdf;base64,${base64Data}`;

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    instructions: prompt,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename: fileName,
            file_data: dataUri,
          },
          {
            type: "input_text",
            text: `Extract content from "${fileName}".`,
          },
        ],
      },
    ],
  });

  const text = response.output_text;
  if (!text || text.length < 5) {
    throw new Error("Insufficient text extracted from PDF");
  }
  return text.trim();
}

// ── Main handler ────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Track documentId at outer scope for error write-back
  let reqDocumentId: string | undefined;

  try {
    // ── Auth check — allow both user auth and service role key ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ success: false, extractedText: "", structuredData: null, error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY") ?? serviceRoleKey,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !user) {
        return jsonResponse({ success: false, extractedText: "", structuredData: null, error: "Unauthorized" }, 401);
      }
    }

    // ── Parse request ────────────────────────────────────────
    const body = await req.json();
    const {
      fileBase64,
      fileName,
      mimeType,
      mode = "document",
      documentId,
    } = body as {
      fileBase64?: string;
      fileName?: string;
      mimeType?: string;
      mode?: "receipt" | "document";
      documentId?: string;
    };

    reqDocumentId = documentId;

    // ── Generate correlation ID for end-to-end tracing ──────
    const correlationId = crypto.randomUUID();

    // ── Resolve file data ────────────────────────────────────
    // Two paths:
    //   1. fileBase64 provided directly (receipt mode / backward compat)
    //   2. documentId provided → download from Supabase Storage
    let resolvedBase64: string;
    let resolvedMimeType: string;
    let resolvedFileName: string;

    if (fileBase64) {
      // ── Path 1: Direct base64 (receipt mode) ──────────────
      if (!mimeType || typeof mimeType !== "string") {
        return jsonResponse(
          { success: false, extractedText: "", structuredData: null, error: "mimeType is required when fileBase64 is provided" },
          400
        );
      }
      if (fileBase64.length > MAX_BASE64_LENGTH) {
        return jsonResponse(
          { success: false, extractedText: "", structuredData: null, error: "File too large. Maximum ~15MB for extraction." },
          400
        );
      }
      resolvedBase64 = fileBase64;
      resolvedMimeType = mimeType;
      resolvedFileName = fileName || "document";
    } else if (documentId) {
      // ── Path 2: Download from Storage ─────────────────────
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Fetch document record
      const { data: doc, error: docError } = await supabaseAdmin
        .from("documents")
        .select("file_url, file_type, extraction_status, name")
        .eq("id", documentId)
        .single();

      if (docError || !doc) {
        return jsonResponse(
          { success: false, extractedText: "", structuredData: null, error: `Document not found: ${docError?.message || "unknown"}` },
          404
        );
      }

      // Prevent duplicate extraction
      if (doc.extraction_status === "completed") {
        return jsonResponse({ success: true, status: "already_extracted" });
      }

      // Mark as processing
      await supabaseAdmin
        .from("documents")
        .update({
          extraction_status: "processing",
          processing_started_at: new Date().toISOString(),
          correlation_id: correlationId,
        })
        .eq("id", documentId);

      // Download file from storage
      const { data: fileData, error: downloadError } = await supabaseAdmin
        .storage.from("documents")
        .download(doc.file_url);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file from storage: ${downloadError?.message || "no data"}`);
      }

      // Convert to base64
      const arrayBuffer = await fileData.arrayBuffer();
      resolvedBase64 = encodeBase64(new Uint8Array(arrayBuffer));
      resolvedMimeType = doc.file_type || "application/octet-stream";
      resolvedFileName = doc.name || "document";

      console.log(`[extract-document-text] [correlation_id=${correlationId}] Downloaded from storage: ${doc.file_url} (${resolvedBase64.length} base64 chars)`);
    } else {
      return jsonResponse(
        { success: false, extractedText: "", structuredData: null, error: "Either fileBase64 or documentId is required" },
        400
      );
    }

    // ── Route by file type ──────────────────────────────────
    const normalizedType = resolvedMimeType.toLowerCase();
    const prompt = mode === "receipt" ? RECEIPT_PROMPT : DOCUMENT_PROMPT;
    let extractedText: string;

    console.log(`[extract-document-text] [correlation_id=${correlationId}] mode:`, mode, "type:", normalizedType, "name:", resolvedFileName, "base64Len:", resolvedBase64.length);

    if (SUPPORTED_IMAGE_TYPES.some((t) => normalizedType.includes(t))) {
      extractedText = await extractTextFromImage(resolvedBase64, normalizedType, prompt);
    } else if (SUPPORTED_PDF_TYPES.some((t) => normalizedType.includes(t))) {
      // Try local text extraction first (instant, no API call)
      const localText = mode !== "receipt"
        ? await extractTextFromPDFLocal(resolvedBase64)
        : null;

      if (localText) {
        extractedText = localText;
        console.log(`[extract-document-text] [correlation_id=${correlationId}] Used local extraction (${localText.length} chars)`);
      } else {
        // Fallback to OpenAI for scanned/image PDFs or receipt mode
        extractedText = await extractTextFromPDF(resolvedBase64, resolvedFileName, prompt);
      }
    } else {
      return jsonResponse(
        { success: false, extractedText: "", structuredData: null, error: `Unsupported file type: ${resolvedMimeType}` },
        400
      );
    }

    // ── Truncate ────────────────────────────────────────────
    if (extractedText.length > MAX_EXTRACTED_TEXT_LENGTH) {
      extractedText =
        extractedText.substring(0, MAX_EXTRACTED_TEXT_LENGTH) +
        "\n\n[Content truncated due to length]";
    }

    // ── Sanitize ────────────────────────────────────────────
    const { sanitized, injectionDetected } = sanitizeExtractedText(extractedText);
    extractedText = sanitized;
    if (injectionDetected) {
      console.warn("[extract-document-text] Injection patterns detected in:", resolvedFileName);
    }

    // ── Build structuredData for receipt mode ────────────────
    let structuredData: Record<string, unknown> | null = null;
    if (mode === "receipt") {
      structuredData = parseReceiptJson(extractedText);
    }

    // ── DB write-back for document mode ─────────────────────
    if (mode === "document" && documentId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        await supabaseAdmin
          .from("documents")
          .update({
            extracted_text: sanitized,
            extraction_status: "completed",
          })
          .eq("id", documentId);

        console.log("[extract-document-text] Saved to DB for document:", documentId);

        // Generate embeddings inline (background task via waitUntil)
        const embeddingPromise = (async () => {
          try {
            const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
            if (!OPENAI_API_KEY) {
              console.error("[extract-document-text] No OPENAI_API_KEY, skipping embeddings");
              return;
            }

            await embRestUpdate("documents", `id=eq.${documentId}`, {
              embedding_status: "processing",
              processing_started_at: new Date().toISOString(),
            });
            await embRestDelete("document_chunks", `document_id=eq.${documentId}`);

            // Get document metadata for chunk records
            const docRows = await embRestSelect<Record<string, unknown>>(
              "documents",
              `id=eq.${documentId}&select=tenant_id,equipment_types,category`
            );
            const docMeta = docRows[0];
            if (!docMeta) throw new Error("Document metadata not found");

            // Resolve equipment brand/model
            let equipmentBrand: string | null = null;
            let equipmentModel: string | null = null;
            let equipmentType: string | null = null;
            if (Array.isArray(docMeta.equipment_types) && (docMeta.equipment_types as string[]).length > 0) {
              equipmentType = (docMeta.equipment_types as string[])[0];
              try {
                const eqRows = await embRestSelect<Record<string, unknown>>(
                  "equipment_registry",
                  `tenant_id=eq.${docMeta.tenant_id}&equipment_type=eq.${encodeURIComponent(equipmentType)}&select=brand,model&limit=1`
                );
                if (eqRows[0]) {
                  equipmentBrand = (eqRows[0].brand as string) || null;
                  equipmentModel = (eqRows[0].model as string) || null;
                }
              } catch (e) {
                console.warn("[extract-document-text] Equipment metadata lookup failed:", e);
              }
            }

            // Chunk the extracted text and process one at a time
            const chunks = chunkTextStructured(sanitized);
            const totalChunks = chunks.length;
            console.log(`[extract-document-text] [correlation_id=${correlationId}] Embedding ${totalChunks} chunks for ${documentId}`);

            let insertedCount = 0;
            let totalTokens = 0;

            for (let i = 0; i < totalChunks; i++) {
              const chunk = chunks[i];
              const embedding = await generateSingleEmbedding(chunk.text, OPENAI_API_KEY, correlationId);
              const tokenCount = estimateTokens(chunk.text);
              totalTokens += tokenCount;

              await embRestInsert("document_chunks", {
                document_id: documentId,
                tenant_id: docMeta.tenant_id,
                chunk_index: i,
                chunk_text: chunk.text,
                embedding: `[${embedding.join(",")}]`,
                token_count: tokenCount,
                chunk_type: chunk.type,
                equipment_type: equipmentType,
                brand: equipmentBrand,
                model: equipmentModel,
                document_category: docMeta.category || null,
                correlation_id: correlationId,
                embedding_model: EMBEDDING_MODEL,
                embedding_dimensions: EMBEDDING_DIMENSION,
              });

              insertedCount++;
              // deno-lint-ignore no-explicit-any
              (chunks as any)[i] = null; // Free processed chunk

              if ((i + 1) % 10 === 0 || i === totalChunks - 1) {
                console.log(`[extract-document-text] Embedded chunk ${i + 1}/${totalChunks}`);
              }
              if (i < totalChunks - 1) {
                await new Promise(r => setTimeout(r, 200));
              }
            }

            await embRestUpdate("documents", `id=eq.${documentId}`, { embedding_status: "completed" });
            console.log(`[extract-document-text] [correlation_id=${correlationId}] Embedding completed: ${insertedCount} chunks, ${totalTokens} tokens`);
          } catch (embErr) {
            console.error(`[extract-document-text] [correlation_id=${correlationId}] Inline embedding failed:`, embErr);
            try {
              await embRestUpdate("documents", `id=eq.${documentId}`, { embedding_status: "failed" });
            } catch (_) { /* ignore status update failure */ }
          }
        })();

        // deno-lint-ignore no-explicit-any
        (globalThis as any).EdgeRuntime?.waitUntil?.(embeddingPromise);
      } catch (dbErr) {
        // Don't fail the response — text was extracted successfully
        console.error("[extract-document-text] DB write-back failed:", dbErr);
      }
    }

    console.log("[extract-document-text] Success:", resolvedFileName, "length:", sanitized.length, "mode:", mode);

    return jsonResponse({
      success: true,
      extractedText: sanitized,
      structuredData,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[extract-document-text] Error:", message);

    // Write error back to documents table for document mode
    if (reqDocumentId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabaseAdmin
          .from("documents")
          .update({
            extraction_status: "failed",
            last_error: message.substring(0, 500),
          })
          .eq("id", reqDocumentId);
      } catch (writeBackErr) {
        console.error("[extract-document-text] Error write-back failed:", writeBackErr);
      }
    }

    return jsonResponse(
      { success: false, extractedText: "", structuredData: null, error: message },
      500
    );
  }
});
