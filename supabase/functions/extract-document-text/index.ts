import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Maximum text to store per document (100KB)
const MAX_EXTRACTED_TEXT_LENGTH = 100000;

// Supported file types for extraction
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const SUPPORTED_PDF_TYPES = ['application/pdf'];
const SUPPORTED_TEXT_TYPES = ['text/plain', 'text/csv', 'text/markdown'];

// Prompt injection patterns that could appear in uploaded documents
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

function sanitizeExtractedText(text: string): { sanitized: string; injectionDetected: boolean } {
  let sanitized = text;
  let injectionDetected = false;

  // Strip control characters (except newlines, tabs, carriage returns)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Strip Unicode bidirectional override characters (text confusion attacks)
  sanitized = sanitized.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');

  // Detect and redact prompt injection patterns
  for (const pattern of DOCUMENT_INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(sanitized)) {
      injectionDetected = true;
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, '[REDACTED-SUSPICIOUS-CONTENT]');
    }
  }

  return { sanitized, injectionDetected };
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
      console.log("[extract-document-text] Authenticated user:", user.id);
    } else {
      console.log("[extract-document-text] Service role access");
    }
    const { documentId } = await req.json();

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "documentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get document record
    const { data: doc, error: docError } = await supabaseAdmin
      .from("documents")
      .select("id, tenant_id, file_url, file_type, name")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      console.error("Document not found:", documentId, docError);
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing document extraction:", doc.id, doc.name, doc.file_type);

    // Update status to processing
    await supabaseAdmin
      .from("documents")
      .update({ extraction_status: "processing" })
      .eq("id", documentId);

    try {
      // Generate signed URL for file access (1 hour expiry)
      const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
        .storage
        .from("documents")
        .createSignedUrl(doc.file_url, 3600);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error(`Failed to create signed URL: ${signedUrlError?.message}`);
      }

      const signedUrl = signedUrlData.signedUrl;
      let extractedText = "";

      // Handle different file types
      const fileType = doc.file_type?.toLowerCase() || "";

      if (SUPPORTED_TEXT_TYPES.some(t => fileType.includes(t))) {
        // Plain text files - just download and use
        console.log("Extracting text from plain text file");
        const textResponse = await fetch(signedUrl);
        extractedText = await textResponse.text();
      } else if (SUPPORTED_IMAGE_TYPES.some(t => fileType.includes(t))) {
        // Images - use AI Vision for OCR
        console.log("Extracting text from image using AI Vision");
        extractedText = await extractTextFromImage(signedUrl);
      } else if (SUPPORTED_PDF_TYPES.some(t => fileType.includes(t))) {
        // PDFs - use AI Vision (first describe that we're processing a PDF)
        console.log("Processing PDF document");
        extractedText = await extractTextFromPDF(signedUrl, doc.name);
      } else {
        // Unsupported file type - attempt generic extraction
        console.log("Attempting generic extraction for unsupported type:", fileType);
        extractedText = await extractTextFromImage(signedUrl);
      }

      // Truncate if too long
      if (extractedText.length > MAX_EXTRACTED_TEXT_LENGTH) {
        extractedText = extractedText.substring(0, MAX_EXTRACTED_TEXT_LENGTH) + "\n\n[Content truncated due to length]";
      }

      // Sanitize extracted text for prompt injection patterns
      const { sanitized, injectionDetected } = sanitizeExtractedText(extractedText);
      extractedText = sanitized;
      if (injectionDetected) {
        console.warn("[extract-document-text] Prompt injection patterns detected in document:", doc.id, doc.name);
      }

      // Update document with extracted text
      const { error: updateError } = await supabaseAdmin
        .from("documents")
        .update({
          extracted_text: extractedText,
          extraction_status: "completed"
        })
        .eq("id", documentId);

      if (updateError) {
        throw new Error(`Failed to update document: ${updateError.message}`);
      }

      console.log("Document extraction completed:", doc.id, "Extracted length:", extractedText.length);

      // Trigger embedding generation as a background task
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      
      // Fire and forget - don't wait for embeddings to complete
      fetch(`${supabaseUrl}/functions/v1/generate-embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`
        },
        body: JSON.stringify({ documentId: doc.id })
      }).then(res => {
        console.log("Embedding generation triggered:", res.status);
      }).catch(err => {
        console.error("Failed to trigger embedding generation:", err);
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          extractedLength: extractedText.length,
          documentId: doc.id
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (extractionError) {
      console.error("Extraction failed:", extractionError);
      
      // Update status to failed
      await supabaseAdmin
        .from("documents")
        .update({ extraction_status: "failed" })
        .eq("id", documentId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: extractionError instanceof Error ? extractionError.message : "Extraction failed"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Extract document text error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Extract text from image using AI Vision
async function extractTextFromImage(imageUrl: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a document OCR assistant. Extract ALL text content from this document image.
Preserve structure (headings, lists, tables as best as possible).
Include ALL specifications, values, part numbers, procedures, warnings, and technical information.
Return ONLY the extracted text, no commentary or descriptions.
If you see a table, format it clearly with aligned columns or as structured text.
Preserve numerical values exactly as shown (temperatures, pressures, voltages, etc.).`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this document image. Include every specification, procedure, and technical detail visible."
            },
            {
              type: "image_url",
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      max_tokens: 16000
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI Vision extraction failed:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted. Please add credits to continue.");
    }
    throw new Error(`AI extraction failed: ${response.status}`);
  }

  const data = await response.json();
  const extractedText = data.choices?.[0]?.message?.content || "";
  
  return extractedText.trim();
}

// Extract text from PDF using AI Vision
// Note: This sends the PDF URL directly - Gemini can process PDFs
async function extractTextFromPDF(pdfUrl: string, docName: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  // For PDFs, we'll use Gemini's document understanding capability
  // Gemini 2.5 Flash can process PDF documents directly via URL
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a technical document extraction specialist. Your task is to extract ALL text content from the provided document.

CRITICAL REQUIREMENTS:
1. Extract EVERY piece of text visible in the document
2. Preserve document structure: headings, sections, lists, tables
3. Include ALL technical specifications: temperatures, pressures, voltages, part numbers, model numbers
4. Include ALL procedures with step numbers preserved
5. Include ALL warnings, cautions, and safety information
6. Include ALL diagrams labels and callouts
7. Format tables in a clear, readable way
8. Include page numbers or section references when visible

OUTPUT FORMAT:
- Return ONLY the extracted text
- Use clear formatting with headers and sections
- Do not add commentary or descriptions
- Do not summarize - extract everything

Document name: ${docName}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `This is a technical document called "${docName}". Extract all text content from every page. Include all specifications, procedures, warnings, and technical details. This content will be used to ground an AI assistant that helps field technicians.`
            },
            {
              type: "image_url",
              image_url: { url: pdfUrl }
            }
          ]
        }
      ],
      max_tokens: 32000 // Higher limit for PDFs with multiple pages
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI PDF extraction failed:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted. Please add credits to continue.");
    }
    throw new Error(`AI extraction failed: ${response.status}`);
  }

  const data = await response.json();
  const extractedText = data.choices?.[0]?.message?.content || "";
  
  if (!extractedText || extractedText.length < 50) {
    console.warn("PDF extraction returned minimal text, may be a scanned document or image-based PDF");
  }
  
  return extractedText.trim();
}
