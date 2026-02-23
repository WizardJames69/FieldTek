import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import OpenAI from "https://deno.land/x/openai@v4.52.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_EXTRACTED_TEXT_LENGTH = 100000;

const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const SUPPORTED_PDF_TYPES = ["application/pdf"];

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

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
});

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

// ── Image extraction ────────────────────────────────────────
// Downloads image → converts to base64 → sends via Responses API input_image
async function extractTextFromImage(
  fileUrl: string,
  mimeType: string
): Promise<string> {
  const imageResponse = await fetch(fileUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: HTTP ${imageResponse.status}`);
  }

  const buffer = await imageResponse.arrayBuffer();
  const b64 = base64Encode(buffer);
  const dataUri = `data:${mimeType};base64,${b64}`;

  const response = await openai.responses.create({
    model: "gpt-4.1",
    instructions: "Extract all visible text from this image. Return plain text only.",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: "Extract all text from this image." },
          { type: "input_image", image_url: dataUri },
        ],
      },
    ],
  });

  const text = response.output_text;
  if (!text || text.length < 5) {
    throw new Error("Insufficient text extracted from image");
  }
  return text.trim();
}

// ── PDF extraction ──────────────────────────────────────────
// Downloads PDF → uploads to OpenAI via files.create → sends via Responses API input_file
async function extractTextFromPDF(
  fileUrl: string,
  docName: string
): Promise<string> {
  const pdfResponse = await fetch(fileUrl);
  if (!pdfResponse.ok) {
    throw new Error(`Failed to download PDF: HTTP ${pdfResponse.status}`);
  }

  const pdfBytes = await pdfResponse.arrayBuffer();

  const uploadedFile = await openai.files.create({
    file: new File([pdfBytes], docName, { type: "application/pdf" }),
    purpose: "assistants",
  });

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1",
      instructions: `You are a technical document extraction specialist. Extract ALL text content from the provided document.

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
- Do not summarize - extract everything`,
      input: [
        {
          role: "user",
          content: [
            { type: "input_file", file_id: uploadedFile.id },
            {
              type: "input_text",
              text: `Extract all text content from this technical document called "${docName}". Include all specifications, procedures, warnings, and technical details.`,
            },
          ],
        },
      ],
    });

    const text = response.output_text;
    if (!text || text.length < 10) {
      throw new Error("Insufficient text extracted from PDF");
    }
    return text.trim();
  } finally {
    // Best-effort cleanup of uploaded file
    await openai.files.del(uploadedFile.id).catch(() => {});
  }
}

// ── Main handler ────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl, fileType, docName } = await req.json();

    if (!fileUrl || !fileType) {
      return new Response(
        JSON.stringify({ success: false, error: "fileUrl and fileType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedType = fileType.toLowerCase();
    let extractedText: string;

    if (SUPPORTED_IMAGE_TYPES.some((t) => normalizedType.includes(t))) {
      console.log("[extract-document-text] Extracting text from image:", docName);
      extractedText = await extractTextFromImage(fileUrl, normalizedType);
    } else if (SUPPORTED_PDF_TYPES.some((t) => normalizedType.includes(t))) {
      console.log("[extract-document-text] Extracting text from PDF:", docName);
      extractedText = await extractTextFromPDF(fileUrl, docName || "document.pdf");
    } else {
      return new Response(
        JSON.stringify({ success: false, error: `Unsupported file type: ${fileType}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Truncate if exceeding limit
    if (extractedText.length > MAX_EXTRACTED_TEXT_LENGTH) {
      extractedText =
        extractedText.substring(0, MAX_EXTRACTED_TEXT_LENGTH) +
        "\n\n[Content truncated due to length]";
    }

    // Sanitize for prompt injection patterns
    const { sanitized, injectionDetected } = sanitizeExtractedText(extractedText);
    extractedText = sanitized;
    if (injectionDetected) {
      console.warn("[extract-document-text] Injection patterns detected in:", docName);
    }

    console.log("[extract-document-text] Success:", docName, "length:", extractedText.length);

    return new Response(
      JSON.stringify({ success: true, extractedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[extract-document-text] Error:", message);

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
