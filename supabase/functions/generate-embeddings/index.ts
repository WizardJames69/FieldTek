import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Configuration
const CHUNK_SIZE = 1500; // Characters per chunk (roughly 375 tokens)
const CHUNK_OVERLAP = 200; // Overlap between chunks for context continuity
const EMBEDDING_MODEL = "text-embedding-3-small"; // OpenAI embedding model
const EMBEDDING_DIMENSION = 1536;

// Text chunking function with overlap
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
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
  
  return chunks.filter(c => c.length > 50); // Filter out very small chunks
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

// Generate embedding using Lovable AI gateway
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSION
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Embedding generation failed:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted. Please add credits to continue.");
    }
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data?.[0]?.embedding || [];
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
    const { documentId } = await req.json();

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "documentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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

    console.log("Processing embeddings for document:", doc.id, doc.name);

    // Update embedding status to processing
    await supabaseAdmin
      .from("documents")
      .update({ embedding_status: "processing" })
      .eq("id", documentId);

    try {
      // Delete existing chunks for this document (in case of re-processing)
      await supabaseAdmin
        .from("document_chunks")
        .delete()
        .eq("document_id", documentId);

      // Chunk the document text
      const chunks = chunkText(doc.extracted_text, CHUNK_SIZE, CHUNK_OVERLAP);
      console.log(`Document split into ${chunks.length} chunks`);

      // Process chunks in batches to avoid rate limits
      const BATCH_SIZE = 5;
      let insertedChunkCount = 0;

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        
        // Generate embeddings for this batch
        const embeddings = await Promise.all(
          batch.map(chunk => generateEmbedding(chunk, LOVABLE_API_KEY))
        );

        // Extract equipment type from parent document (first entry if array)
        const equipmentType = Array.isArray(doc.equipment_types) && doc.equipment_types.length > 0
          ? doc.equipment_types[0]
          : null;

        // Prepare chunk records
        const chunkRecords = batch.map((chunkText, batchIndex) => ({
          document_id: doc.id,
          tenant_id: doc.tenant_id,
          chunk_index: i + batchIndex,
          chunk_text: chunkText,
          embedding: `[${embeddings[batchIndex].join(",")}]`, // Format as vector string
          token_count: estimateTokens(chunkText),
          chunk_type: classifyChunkType(chunkText),
          equipment_type: equipmentType,
        }));

        // Insert chunks
        const { error: insertError } = await supabaseAdmin
          .from("document_chunks")
          .insert(chunkRecords);

        if (insertError) {
          throw new Error(`Failed to insert chunks: ${insertError.message}`);
        }

        insertedChunkCount += chunkRecords.length;

        console.log(`Processed chunks ${i + 1} to ${Math.min(i + BATCH_SIZE, chunks.length)} of ${chunks.length}`);
        
        // Small delay between batches to avoid rate limits
        if (i + BATCH_SIZE < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Update document embedding status
      await supabaseAdmin
        .from("documents")
        .update({ embedding_status: "completed" })
        .eq("id", documentId);

      console.log("Embedding generation completed:", doc.id, "Chunks created:", insertedChunkCount);

      return new Response(
        JSON.stringify({
          success: true,
          documentId: doc.id,
          chunksCreated: insertedChunkCount,
          totalTokens: chunks.reduce((sum, c) => sum + estimateTokens(c), 0)
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
