// ============================================================
// Shared Content-Aware Chunking for Document Embedding
// ============================================================
// Used by both extract-document-text (inline embedding) and
// generate-embeddings (standalone re-embedding).

// ── Configuration ───────────────────────────────────────────

export const MAX_CHUNK_SIZE = 3000; // Max chars for structured chunks (tables, procedures)
export const DEFAULT_CHUNK_SIZE = 1500; // Default chars for narrative chunks (~375 tokens)
export const CHUNK_OVERLAP = 200; // Overlap between narrative chunks for context continuity
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSION = 1536;

// ── Types ───────────────────────────────────────────────────

export interface StructuredChunk {
  text: string;
  type: 'narrative' | 'table' | 'procedure' | 'specification';
}

// ── Main Entry Point ────────────────────────────────────────

export function chunkTextStructured(text: string): StructuredChunk[] {
  const chunks: StructuredChunk[] = [];
  const sections = splitIntoSections(text);

  for (const section of sections) {
    const type = classifyChunkType(section);

    if (type === 'table' || type === 'procedure' || type === 'specification') {
      if (section.length <= MAX_CHUNK_SIZE) {
        chunks.push({ text: section.trim(), type });
      } else {
        const subChunks = splitStructuredContent(section, type);
        for (const sub of subChunks) {
          chunks.push({ text: sub.trim(), type });
        }
      }
    } else {
      const narrativeChunks = chunkTextSliding(section, DEFAULT_CHUNK_SIZE, CHUNK_OVERLAP);
      for (const nc of narrativeChunks) {
        chunks.push({ text: nc.trim(), type: 'narrative' });
      }
    }
  }

  const result = chunks.filter(c => c.text.length > 50);

  // Safety guard: cap chunk count to prevent runaway processing
  const MAX_CHUNKS = 500;
  if (result.length > MAX_CHUNKS) {
    console.warn(`[chunking] Truncating ${result.length} chunks to ${MAX_CHUNKS}`);
    result.length = MAX_CHUNKS;
  }

  return result;
}

// ── Section Splitting ───────────────────────────────────────

function splitIntoSections(text: string): string[] {
  const lines = text.split('\n');
  const sections: string[] = [];
  let currentSection: string[] = [];
  let currentType: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineType = getLineType(line);

    const isBlankLine = line.trim() === '';
    const isHeading = /^#{1,6}\s/.test(line) || /^[A-Z][A-Z\s]{3,}:?\s*$/.test(line.trim());
    const typeChanged = currentType !== null && lineType !== 'neutral' && lineType !== currentType;

    if ((isBlankLine && currentSection.length > 0) || isHeading || typeChanged) {
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

  if (currentSection.length > 0) {
    const sectionText = currentSection.join('\n');
    if (sectionText.trim().length > 0) {
      sections.push(sectionText);
    }
  }

  return mergeTinySections(sections, 100);
}

function getLineType(line: string): 'table' | 'procedure' | 'specification' | 'neutral' {
  const trimmed = line.trim();
  if (!trimmed) return 'neutral';

  if ((trimmed.match(/\|/g) || []).length >= 2) return 'table';
  if (/^\s*(\d+[\.\):]|\-|\•|Step\s+\d)/i.test(trimmed)) return 'procedure';
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

// ── Structured Content Splitting ────────────────────────────

function splitStructuredContent(text: string, type: string): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const line of lines) {
    const lineLen = line.length + 1;

    if (currentLen + lineLen > MAX_CHUNK_SIZE && current.length > 0) {
      if (type === 'table' && current.length > 0) {
        const firstLine = current[0];
        chunks.push(current.join('\n'));
        current = [];
        currentLen = 0;
        if ((firstLine.match(/\|/g) || []).length >= 2) {
          current.push(firstLine);
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

// ── Sliding Window Chunker ──────────────────────────────────

function chunkTextSliding(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

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

// ── Classification ──────────────────────────────────────────

function classifyChunkType(text: string): 'narrative' | 'table' | 'procedure' | 'specification' {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return 'narrative';

  const tableLines = lines.filter(l => (l.match(/\|/g) || []).length >= 2 || l.includes('\t'));
  if (tableLines.length / lines.length >= 0.3) return 'table';

  const stepLines = lines.filter(l => /^\s*(\d+[\.\):]|\-|\•|Step\s+\d)/i.test(l));
  if (stepLines.length / lines.length >= 0.4) return 'procedure';

  const specLines = lines.filter(l => /^[A-Za-z][^:]{2,30}:\s+\S/.test(l));
  if (specLines.length / lines.length >= 0.4) return 'specification';

  return 'narrative';
}

// ── Utilities ───────────────────────────────────────────────

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
