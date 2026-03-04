// ============================================================
// Field Assistant — Response & Input Validation
// ============================================================

import {
  BLOCKED_PATTERNS_WITHOUT_CITATION,
  CITATION_PATTERN,
  CODE_CITATION_PATTERN,
  KNOWN_CODE_PREFIXES,
  PROMPT_INJECTION_PATTERNS,
  MAX_MESSAGE_LENGTH,
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_SIZE_BYTES,
} from "./constants.ts";
import type { MessageContent } from "./types.ts";

// ── Prompt Injection Detection ──────────────────────────────

export function detectPromptInjection(text: string): { isInjection: boolean; pattern?: string } {
  const normalizedText = text.toLowerCase();

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(normalizedText)) {
      return { isInjection: true, pattern: pattern.source };
    }
  }

  return { isInjection: false };
}

// ── Citation Source Validation ───────────────────────────────

export function validateCitationSources(
  response: string,
  documentNames: string[],
  codeReferenceEnabled: boolean
): { valid: boolean; invalidSources: string[] } {
  const sourceRegex = /\[Source:\s*([^\]]+)\]/gi;
  const invalidSources: string[] = [];
  let match;

  while ((match = sourceRegex.exec(response)) !== null) {
    const citedSource = match[1].trim();

    if (codeReferenceEnabled) {
      const isCodeRef = KNOWN_CODE_PREFIXES.some(prefix =>
        citedSource.toUpperCase().startsWith(prefix)
      );
      if (isCodeRef) continue;
    }

    const matchesDocument = documentNames.some(docName => {
      const normalizedCited = citedSource.toLowerCase();
      const normalizedDoc = docName.toLowerCase();
      return normalizedDoc === normalizedCited ||
             normalizedDoc.includes(normalizedCited) ||
             normalizedCited.includes(normalizedDoc);
    });

    if (!matchesDocument) {
      invalidSources.push(citedSource);
    }
  }

  return { valid: invalidSources.length === 0, invalidSources };
}

// ── Full AI Response Validation ─────────────────────────────

export function validateAIResponse(
  fullResponse: string,
  hasDocuments: boolean,
  codeReferenceEnabled?: boolean,
  validDocumentNames?: string[]
): { valid: boolean; reason?: string } {
  for (const pattern of BLOCKED_PATTERNS_WITHOUT_CITATION) {
    pattern.lastIndex = 0;
    if (pattern.test(fullResponse)) {
      const hasDocCitation = CITATION_PATTERN.test(fullResponse);
      const hasCodeCitation = codeReferenceEnabled && CODE_CITATION_PATTERN.test(fullResponse);

      if (!hasDocCitation && !hasCodeCitation) {
        return {
          valid: false,
          reason: `Response contains technical information without documentation citation. Pattern detected: ${pattern.source}`
        };
      }

      if (!hasDocuments && !hasCodeCitation) {
        return {
          valid: false,
          reason: "Response contains technical information but no documentation is available in the system."
        };
      }
    }
  }

  if (validDocumentNames && validDocumentNames.length > 0 && CITATION_PATTERN.test(fullResponse)) {
    const citationCheck = validateCitationSources(
      fullResponse,
      validDocumentNames,
      !!codeReferenceEnabled
    );
    if (!citationCheck.valid) {
      return {
        valid: false,
        reason: `Response cites unknown documents: ${citationCheck.invalidSources.join(', ')}. Only uploaded documents and known code references are allowed.`
      };
    }
  }

  return { valid: true };
}

// ── Per-Paragraph Citation Validation ───────────────────────

export function validateParagraphCitations(response: string): { uncitedParagraphs: number; totalTechnicalParagraphs: number } {
  const paragraphs = response.split(/\n\n+/).filter(p => p.trim().length > 50);
  const TECHNICAL_INDICATORS = /\d+\.?\d*\s*(psi|kPa|bar|°F|°C|volts?|amps?|watts?|ohms?|PSI|V|A|W)|step\s+\d+|procedure|specification|warranty/i;

  let totalTechnicalParagraphs = 0;
  let uncitedParagraphs = 0;

  for (const para of paragraphs) {
    if (TECHNICAL_INDICATORS.test(para)) {
      totalTechnicalParagraphs++;
      if (!CITATION_PATTERN.test(para)) {
        uncitedParagraphs++;
      }
    }
  }

  return { uncitedParagraphs, totalTechnicalParagraphs };
}

// ── Message Content Validation ──────────────────────────────

export function validateMessageContent(content: MessageContent): boolean {
  if (typeof content === "string") {
    return content.length <= MAX_MESSAGE_LENGTH;
  }

  if (Array.isArray(content)) {
    let imageCount = 0;
    for (const part of content) {
      if (part.type === "text") {
        if (typeof part.text !== "string" || part.text.length > MAX_MESSAGE_LENGTH) {
          return false;
        }
      } else if (part.type === "image_url") {
        imageCount++;
        if (imageCount > MAX_IMAGES_PER_MESSAGE) return false;

        const url = part.image_url?.url;
        if (typeof url !== "string") return false;

        if (url.startsWith("data:image/")) {
          const base64Data = url.split(",")[1];
          if (base64Data && base64Data.length > MAX_IMAGE_SIZE_BYTES) {
            return false;
          }
        }
      } else {
        return false;
      }
    }
    return true;
  }

  return false;
}
