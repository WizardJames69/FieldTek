import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithFallback } from "../_shared/aiClient.ts";

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

// Generate embeddings for a batch of texts using OpenAI batch API (single request)
async function generateEmbeddingBatch(texts: string[], apiKey: string, correlationId?: string): Promise<number[][]> {
  const { response, gatewayUsed } = await fetchWithFallback(
    "/embeddings",
    {
      model: EMBEDDING_MODEL,
      input: texts,
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
  // OpenAI returns embeddings sorted by index
  const sorted = (data.data || []).sort((a: any, b: any) => a.index - b.index);
  return sorted.map((item: any) => item.embedding || []);
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
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get document with extracted text
    const { data: doc, error: docError } = await supabaseAdmin
      .from("documents")
      .select("id, tenant_id, name, extracted_text, extraction_status, category, equipment_types")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      console.error("Document not found:", documentId, docError);
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
        const { data: equipment } = await supabaseAdmin
          .from("equipment_registry")
          .select("brand, model")
          .eq("tenant_id", doc.tenant_id)
          .eq("equipment_type", doc.equipment_types[0])
          .limit(1)
          .maybeSingle();
        if (equipment) {
          equipmentBrand = equipment.brand || null;
          equipmentModel = equipment.model || null;
        }
      } catch (e) {
        console.warn(`[generate-embeddings] [correlation_id=${correlationId}] Failed to resolve equipment metadata:`, e);
      }
    }

    // Update embedding status to processing with timestamp for retry tracking
    await supabaseAdmin
      .from("documents")
      .update({ embedding_status: "processing", processing_started_at: new Date().toISOString() })
      .eq("id", documentId);

    try {
      // Delete existing chunks for this document (in case of re-processing)
      await supabaseAdmin
        .from("document_chunks")
        .delete()
        .eq("document_id", documentId);

      // Chunk the document text using structure-aware chunking
      const structuredChunks: (StructuredChunk | null)[] = chunkTextStructured(doc.extracted_text);
      const totalChunks = structuredChunks.length;
      console.log(`[generate-embeddings] [correlation_id=${correlationId}] Document split into ${totalChunks} structured chunks`);

      // Free extracted text from memory (~100K chars)
      // deno-lint-ignore no-explicit-any
      (doc as any).extracted_text = null;

      // Extract equipment type from parent document (first entry if array)
      const equipmentType = Array.isArray(doc.equipment_types) && doc.equipment_types.length > 0
        ? doc.equipment_types[0]
        : null;

      // Process chunks in small batches to stay within memory limits
      const BATCH_SIZE = 3;
      let insertedChunkCount = 0;
      let totalTokens = 0;

      for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
        const batchEnd = Math.min(i + BATCH_SIZE, totalChunks);
        const batch: StructuredChunk[] = [];
        for (let j = i; j < batchEnd; j++) {
          if (structuredChunks[j]) batch.push(structuredChunks[j]!);
        }

        if (batch.length === 0) continue;

        // Generate embeddings for batch in a single API call
        const embeddings = await generateEmbeddingBatch(
          batch.map(c => c.text), OPENAI_API_KEY, correlationId
        );

        // Prepare chunk records with full metadata
        const chunkRecords = batch.map((chunk, batchIndex) => {
          const tokenCount = estimateTokens(chunk.text);
          totalTokens += tokenCount;
          return {
            document_id: doc.id,
            tenant_id: doc.tenant_id,
            chunk_index: i + batchIndex,
            chunk_text: chunk.text,
            embedding: `[${embeddings[batchIndex].join(",")}]`,
            token_count: tokenCount,
            chunk_type: chunk.type,
            equipment_type: equipmentType,
            brand: equipmentBrand,
            model: equipmentModel,
            document_category: doc.category || null,
            correlation_id: correlationId,
            embedding_model: EMBEDDING_MODEL,
            embedding_dimensions: EMBEDDING_DIMENSION,
          };
        });

        // Insert chunks
        const { error: insertError } = await supabaseAdmin
          .from("document_chunks")
          .insert(chunkRecords);

        if (insertError) {
          throw new Error(`Failed to insert chunks: ${insertError.message}`);
        }

        insertedChunkCount += chunkRecords.length;

        // Free processed chunks from memory
        for (let j = i; j < batchEnd; j++) {
          structuredChunks[j] = null;
        }

        console.log(`Processed chunks ${i + 1}-${batchEnd} of ${totalChunks}`);

        // Small delay between batches to avoid rate limits
        if (batchEnd < totalChunks) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Update document embedding status
      await supabaseAdmin
        .from("documents")
        .update({ embedding_status: "completed" })
        .eq("id", documentId);

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
      await supabaseAdmin
        .from("documents")
        .update({ embedding_status: "failed" })
        .eq("id", documentId);

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
