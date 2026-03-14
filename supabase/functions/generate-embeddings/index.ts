import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchWithFallback } from "../_shared/aiClient.ts";

// Raw Supabase REST helpers (no supabase-js SDK to save ~100MB heap)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? SUPABASE_SERVICE_ROLE_KEY;

function restHeaders(prefer = "return=minimal"): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Prefer": prefer,
  };
}

async function restSelect<T>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: restHeaders("return=representation"),
  });
  if (!res.ok) throw new Error(`REST select ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function restInsert(table: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: restHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`REST insert ${table} failed: ${res.status} ${err}`);
  }
}

async function restUpdate(table: string, query: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: restHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`REST update ${table} failed: ${res.status} ${err}`);
  }
}

async function restDelete(table: string, query: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: restHeaders(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`REST delete ${table} failed: ${res.status} ${err}`);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Configuration
const MAX_CHUNK_SIZE = 3000; // Max chars for structured chunks (tables, procedures)
const DEFAULT_CHUNK_SIZE = 1500; // Default chars for narrative chunks (~375 tokens)
const CHUNK_OVERLAP = 200; // Overlap between narrative chunks for context continuity
const EMBEDDING_MODEL = "text-embedding-3-small"; // OpenAI embedding model
const EMBEDDING_DIMENSION = 1536;

// ── Structured Chunk Interface ──────────────────────────────

interface StructuredChunk {
  text: string;
  type: 'narrative' | 'table' | 'procedure' | 'specification';
}

// ── Content-Aware Chunking ──────────────────────────────────
// Splits text into sections by structure, then chunks each section
// according to its type. Tables and procedures are kept as complete
// units (up to MAX_CHUNK_SIZE); narratives use sliding window.

function chunkTextStructured(text: string): StructuredChunk[] {
  const chunks: StructuredChunk[] = [];
  const sections = splitIntoSections(text);

  for (const section of sections) {
    const type = classifyChunkType(section);

    if (type === 'table' || type === 'procedure' || type === 'specification') {
      // Structured content: keep as one chunk if it fits, otherwise split carefully
      if (section.length <= MAX_CHUNK_SIZE) {
        chunks.push({ text: section.trim(), type });
      } else {
        // Split structured content at logical boundaries
        const subChunks = splitStructuredContent(section, type);
        for (const sub of subChunks) {
          chunks.push({ text: sub.trim(), type });
        }
      }
    } else {
      // Narrative content: use sliding window with overlap
      const narrativeChunks = chunkTextSliding(section, DEFAULT_CHUNK_SIZE, CHUNK_OVERLAP);
      for (const nc of narrativeChunks) {
        chunks.push({ text: nc.trim(), type: 'narrative' });
      }
    }
  }

  return chunks.filter(c => c.text.length > 50);
}

// Split text into logical sections by blank lines, headings, or structure changes
function splitIntoSections(text: string): string[] {
  const lines = text.split('\n');
  const sections: string[] = [];
  let currentSection: string[] = [];
  let currentType: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineType = getLineType(line);

    // Detect section boundaries: blank lines, heading changes, type transitions
    const isBlankLine = line.trim() === '';
    const isHeading = /^#{1,6}\s/.test(line) || /^[A-Z][A-Z\s]{3,}:?\s*$/.test(line.trim());
    const typeChanged = currentType !== null && lineType !== 'neutral' && lineType !== currentType;

    if ((isBlankLine && currentSection.length > 0) || isHeading || typeChanged) {
      // If the current section is substantial, flush it
      if (currentSection.length > 0) {
        const sectionText = currentSection.join('\n');
        if (sectionText.trim().length > 0) {
          sections.push(sectionText);
        }
        currentSection = [];
        currentType = null;
      }
    }

    if (!isBlankLine || currentSection.length > 0) {
      currentSection.push(line);
      if (lineType !== 'neutral') {
        currentType = lineType;
      }
    }
  }

  // Flush remaining
  if (currentSection.length > 0) {
    const sectionText = currentSection.join('\n');
    if (sectionText.trim().length > 0) {
      sections.push(sectionText);
    }
  }

  // Merge very small sections (< 100 chars) with neighbors
  return mergeTinySections(sections, 100);
}

function getLineType(line: string): 'table' | 'procedure' | 'specification' | 'neutral' {
  const trimmed = line.trim();
  if (!trimmed) return 'neutral';

  // Table line: has multiple | delimiters or tab-separated values
  if ((trimmed.match(/\|/g) || []).length >= 2) return 'table';

  // Procedure line: numbered step, bullet, or "Step N"
  if (/^\s*(\d+[\.\):]|\-|\•|Step\s+\d)/i.test(trimmed)) return 'procedure';

  // Specification line: key:value pair
  if (/^[A-Za-z][^:]{2,30}:\s+\S/.test(trimmed)) return 'specification';

  return 'neutral';
}

function mergeTinySections(sections: string[], minLength: number): string[] {
  if (sections.length <= 1) return sections;

  const merged: string[] = [];
  let buffer = '';

  for (const section of sections) {
    if (buffer.length > 0) {
      if (section.length < minLength) {
        buffer += '\n' + section;
      } else if (buffer.length < minLength) {
        buffer += '\n' + section;
        merged.push(buffer);
        buffer = '';
      } else {
        merged.push(buffer);
        buffer = section;
      }
    } else if (section.length < minLength) {
      buffer = section;
    } else {
      merged.push(section);
    }
  }

  if (buffer.length > 0) {
    if (merged.length > 0 && buffer.length < minLength) {
      merged[merged.length - 1] += '\n' + buffer;
    } else {
      merged.push(buffer);
    }
  }

  return merged;
}

// Split large structured content at logical boundaries
function splitStructuredContent(text: string, type: string): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const line of lines) {
    const lineLen = line.length + 1; // +1 for newline

    if (currentLen + lineLen > MAX_CHUNK_SIZE && current.length > 0) {
      // For tables: try to keep header row with data
      if (type === 'table' && current.length > 0) {
        // Check if first line looks like a header
        const firstLine = current[0];
        chunks.push(current.join('\n'));
        current = [];
        currentLen = 0;
        // Re-add header for context in next chunk
        if ((firstLine.match(/\|/g) || []).length >= 2) {
          current.push(firstLine);
          // Also include separator line if it exists
          if (lines.length > 1 && /^[\|\s\-:]+$/.test(lines[1])) {
            current.push(lines[1]);
          }
          currentLen = current.join('\n').length;
        }
      } else {
        chunks.push(current.join('\n'));
        current = [];
        currentLen = 0;
      }
    }

    current.push(line);
    currentLen += lineLen;
  }

  if (current.length > 0) {
    chunks.push(current.join('\n'));
  }

  return chunks;
}

// Sliding window chunker for narrative text (original algorithm)
function chunkTextSliding(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    // Try to break at sentence or paragraph boundaries
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > chunkSize * 0.5) {
        chunk = chunk.slice(0, breakPoint + 1);
      }
    }

    chunks.push(chunk.trim());
    start = start + chunk.length - overlap;

    if (start >= text.length) break;
  }

  return chunks.filter(c => c.length > 50);
}

// Estimate token count (rough approximation: 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Classify chunk content type based on line patterns
function classifyChunkType(text: string): string {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return 'narrative';

  // Table: 30%+ lines contain multiple | delimiters or tab-separated columns
  const tableLines = lines.filter(l => (l.match(/\|/g) || []).length >= 2 || l.includes('\t'));
  if (tableLines.length / lines.length >= 0.3) return 'table';

  // Procedure: 40%+ lines start with numbered steps, bullets, or "Step N"
  const stepLines = lines.filter(l => /^\s*(\d+[\.\):]|\-|\•|Step\s+\d)/i.test(l));
  if (stepLines.length / lines.length >= 0.4) return 'procedure';

  // Specification: 40%+ lines are key:value pairs
  const specLines = lines.filter(l => /^[A-Za-z][^:]{2,30}:\s+\S/.test(l));
  if (specLines.length / lines.length >= 0.4) return 'specification';

  return 'narrative';
}

// Generate embedding for a single text using OpenAI API
async function generateSingleEmbedding(text: string, apiKey: string, correlationId?: string): Promise<number[]> {
  const { response, gatewayUsed } = await fetchWithFallback(
    "/embeddings",
    {
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSION,
    },
    apiKey,
    correlationId,
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Embedding generation failed (${gatewayUsed}):`, response.status, errorText);

    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted. Please add credits to continue.");
    }
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  if (gatewayUsed === "fallback") {
    console.warn(`[generate-embeddings] Used fallback gateway for embedding`);
  }

  const data = await response.json();
  const embedding: number[] = data.data?.[0]?.embedding || [];
  return embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check - allow both user auth and service role key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;

    if (!isServiceRole) {
      // Verify user JWT via GoTrue API (no SDK needed)
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          "Authorization": authHeader,
          "apikey": SUPABASE_ANON_KEY,
        },
      });
      if (!authRes.ok) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const user = await authRes.json();
      console.log("[generate-embeddings] Authenticated user:", user.id);
    } else {
      console.log("[generate-embeddings] Service role access");
    }
    const { documentId, correlationId: incomingCorrelationId } = await req.json();
    const correlationId = incomingCorrelationId || crypto.randomUUID();

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "documentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Get document with extracted text (raw REST)
    const docs = await restSelect<Record<string, unknown>>(
      "documents",
      `id=eq.${documentId}&select=id,tenant_id,name,extracted_text,extraction_status,category,equipment_types`
    );
    const doc = docs[0];

    if (!doc) {
      console.error("Document not found:", documentId);
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if text extraction is complete
    if (doc.extraction_status !== "completed" || !doc.extracted_text) {
      return new Response(
        JSON.stringify({ error: "Document text extraction not complete" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-embeddings] [correlation_id=${correlationId}] Processing document:`, doc.id, doc.name);

    // Resolve brand/model from equipment_registry if document is linked to equipment
    let equipmentBrand: string | null = null;
    let equipmentModel: string | null = null;
    if (Array.isArray(doc.equipment_types) && doc.equipment_types.length > 0) {
      try {
        const eqRows = await restSelect<Record<string, unknown>>(
          "equipment_registry",
          `tenant_id=eq.${doc.tenant_id}&equipment_type=eq.${encodeURIComponent(doc.equipment_types[0])}&select=brand,model&limit=1`
        );
        if (eqRows[0]) {
          equipmentBrand = (eqRows[0].brand as string) || null;
          equipmentModel = (eqRows[0].model as string) || null;
        }
      } catch (e) {
        console.warn(`[generate-embeddings] [correlation_id=${correlationId}] Failed to resolve equipment metadata:`, e);
      }
    }

    // Update embedding status to processing with timestamp for retry tracking
    await restUpdate("documents", `id=eq.${documentId}`, {
      embedding_status: "processing",
      processing_started_at: new Date().toISOString(),
    });

    try {
      // Delete existing chunks for this document (in case of re-processing)
      await restDelete("document_chunks", `document_id=eq.${documentId}`);

      // Chunk the document text — keep only boundary info (start/end/type), not text content
      const rawChunks = chunkTextStructured(doc.extracted_text as string);
      const totalChunks = rawChunks.length;
      console.log(`[generate-embeddings] [correlation_id=${correlationId}] Document split into ${totalChunks} structured chunks`);

      // Store chunk boundaries + types, then free the full text and raw chunks
      const chunkMeta: { text: string; type: string }[] = rawChunks.map(c => ({ text: c.text, type: c.type }));
      // deno-lint-ignore no-explicit-any
      (rawChunks as any).length = 0; // Free raw chunk objects
      // deno-lint-ignore no-explicit-any
      (doc as any).extracted_text = null; // Free ~100K chars

      // Extract equipment type from parent document (first entry if array)
      const equipmentType = Array.isArray(doc.equipment_types) && doc.equipment_types.length > 0
        ? doc.equipment_types[0]
        : null;

      // Process ONE chunk at a time to minimize peak memory
      let insertedChunkCount = 0;
      let totalTokens = 0;

      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunkMeta[i];

        // Generate embedding for this single chunk
        const embedding = await generateSingleEmbedding(chunk.text, OPENAI_API_KEY, correlationId);

        // Build the embedding string and insert immediately
        const tokenCount = estimateTokens(chunk.text);
        totalTokens += tokenCount;

        await restInsert("document_chunks", {
          document_id: doc.id,
          tenant_id: doc.tenant_id,
          chunk_index: i,
          chunk_text: chunk.text,
          embedding: `[${embedding.join(",")}]`,
          token_count: tokenCount,
          chunk_type: chunk.type,
          equipment_type: equipmentType,
          brand: equipmentBrand,
          model: equipmentModel,
          document_category: doc.category || null,
          correlation_id: correlationId,
          embedding_model: EMBEDDING_MODEL,
          embedding_dimensions: EMBEDDING_DIMENSION,
        });

        insertedChunkCount++;

        // Null out the chunk text so GC can reclaim it
        // deno-lint-ignore no-explicit-any
        (chunkMeta as any)[i] = null;

        if ((i + 1) % 10 === 0 || i === totalChunks - 1) {
          console.log(`[generate-embeddings] Processed chunk ${i + 1}/${totalChunks}`);
        }

        // Small delay between chunks to avoid rate limits
        if (i < totalChunks - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Update document embedding status
      await restUpdate("documents", `id=eq.${documentId}`, { embedding_status: "completed" });

      console.log(`[generate-embeddings] [correlation_id=${correlationId}] Completed:`, doc.id, "Chunks:", insertedChunkCount);

      return new Response(
        JSON.stringify({
          success: true,
          documentId: doc.id,
          chunksCreated: insertedChunkCount,
          totalTokens,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (embeddingError) {
      console.error("Embedding generation failed:", embeddingError);

      // Update status to failed
      await restUpdate("documents", `id=eq.${documentId}`, { embedding_status: "failed" });

      return new Response(
        JSON.stringify({
          success: false,
          error: embeddingError instanceof Error ? embeddingError.message : "Embedding generation failed"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Generate embeddings error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
