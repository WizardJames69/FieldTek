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

// Page boundary marker injected by extractors that preserve per-page text
// (e.g. unpdf in extract-document-text). Not part of document content.
// Format: [[PAGE:<N>]] on its own line or inline — stripped before emission.
const PAGE_MARKER_REGEX = /\[\[PAGE:(\d+)\]\]/g;

// ── Types ───────────────────────────────────────────────────

export interface StructuredChunk {
  text: string;
  type: 'narrative' | 'table' | 'procedure' | 'specification';
  page_number: number | null;
  section_name: string | null;
}

interface AnnotatedLine {
  text: string;
  page: number | null;
}

interface AnnotatedSection {
  lines: AnnotatedLine[];
  section_name: string | null;
}

// ── Main Entry Point ────────────────────────────────────────

// Safety guard: cap chunk count to prevent runaway processing.
export const MAX_CHUNKS = 500;

export interface ChunkingResult {
  chunks: StructuredChunk[];
  /** Chunk count produced BEFORE the MAX_CHUNKS cap was applied. */
  rawChunkCount: number;
  /** True when the document exceeded MAX_CHUNKS and was capped. */
  cappedAtMax: boolean;
}

// Returns the chunks plus capping stats so ingestion can record a truthful
// "partial" warning when a large document is capped. chunkTextStructured()
// below preserves the original chunks-only signature for existing callers.
export function chunkTextStructuredWithStats(text: string): ChunkingResult {
  const annotatedLines = parseAndStripPageMarkers(text);
  const sections = splitIntoSections(annotatedLines);
  const chunks: StructuredChunk[] = [];

  for (const section of sections) {
    const sectionText = section.lines.map(l => l.text).join('\n');
    const sectionPage = firstNonNullPage(section.lines);
    const sectionName = section.section_name;
    const type = classifyChunkType(sectionText);

    if (type === 'table' || type === 'procedure' || type === 'specification') {
      if (sectionText.length <= MAX_CHUNK_SIZE) {
        chunks.push({ text: sectionText.trim(), type, page_number: sectionPage, section_name: sectionName });
      } else {
        const subChunks = splitStructuredContent(sectionText, type);
        for (const sub of subChunks) {
          chunks.push({ text: sub.trim(), type, page_number: sectionPage, section_name: sectionName });
        }
      }
    } else {
      const narrativeChunks = chunkTextSliding(sectionText, DEFAULT_CHUNK_SIZE, CHUNK_OVERLAP);
      for (const nc of narrativeChunks) {
        chunks.push({ text: nc.trim(), type: 'narrative', page_number: sectionPage, section_name: sectionName });
      }
    }
  }

  const result = chunks.filter(c => c.text.length > 50);
  const rawChunkCount = result.length;

  let cappedAtMax = false;
  if (result.length > MAX_CHUNKS) {
    console.warn(`[chunking] Truncating ${result.length} chunks to ${MAX_CHUNKS}`);
    result.length = MAX_CHUNKS;
    cappedAtMax = true;
  }

  return { chunks: result, rawChunkCount, cappedAtMax };
}

export function chunkTextStructured(text: string): StructuredChunk[] {
  return chunkTextStructuredWithStats(text).chunks;
}

// ── Page marker parsing ─────────────────────────────────────

function parseAndStripPageMarkers(text: string): AnnotatedLine[] {
  let currentPage: number | null = null;
  const rawLines = text.split('\n');
  const annotated: AnnotatedLine[] = [];

  for (const rawLine of rawLines) {
    PAGE_MARKER_REGEX.lastIndex = 0;
    const matches = [...rawLine.matchAll(PAGE_MARKER_REGEX)];
    if (matches.length > 0) {
      // The last marker on the line wins for subsequent content on this line
      // and all following lines until overridden.
      const lastMatch = matches[matches.length - 1];
      const n = parseInt(lastMatch[1], 10);
      if (!Number.isNaN(n)) currentPage = n;
    }
    const cleaned = rawLine.replace(PAGE_MARKER_REGEX, '').trimEnd();
    // Drop lines that were only page markers (avoid double-blank lines messing
    // up section detection).
    if (matches.length > 0 && cleaned.trim() === '') continue;
    annotated.push({ text: cleaned, page: currentPage });
  }

  return annotated;
}

function firstNonNullPage(lines: AnnotatedLine[]): number | null {
  for (const l of lines) {
    if (l.page !== null) return l.page;
  }
  return null;
}

// ── Section Splitting ───────────────────────────────────────

function splitIntoSections(lines: AnnotatedLine[]): AnnotatedSection[] {
  const sections: AnnotatedSection[] = [];
  let currentLines: AnnotatedLine[] = [];
  let currentType: string | null = null;
  let currentSectionName: string | null = null;
  let pendingHeading: string | null = null;

  const flush = () => {
    if (currentLines.length === 0) return;
    const joined = currentLines.map(l => l.text).join('\n');
    if (joined.trim().length > 0) {
      sections.push({ lines: currentLines, section_name: currentSectionName });
    }
    currentLines = [];
    currentType = null;
    // currentSectionName intentionally persists across flushes: every
    // section until the next heading belongs to the nearest preceding
    // heading, not just the first paragraph after it.
  };

  for (let i = 0; i < lines.length; i++) {
    const { text: line, page } = lines[i];
    const lineType = getLineType(line);

    const isBlankLine = line.trim() === '';
    const isHeading = /^#{1,6}\s/.test(line) || /^[A-Z][A-Z\s]{3,}:?\s*$/.test(line.trim());
    const typeChanged = currentType !== null && lineType !== 'neutral' && lineType !== currentType;

    if ((isBlankLine && currentLines.length > 0) || isHeading || typeChanged) {
      flush();
      // If the boundary is a heading, the heading itself starts the next section
      // and also becomes the section_name.
      if (isHeading) {
        pendingHeading = line.trim().replace(/^#+\s*/, '').replace(/:$/, '').trim() || null;
      }
    }

    if (!isBlankLine || currentLines.length > 0) {
      if (currentLines.length === 0 && pendingHeading !== null) {
        currentSectionName = pendingHeading;
        pendingHeading = null;
      }
      currentLines.push({ text: line, page });
      if (lineType !== 'neutral') {
        currentType = lineType;
      }
    }
  }

  flush();

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

function mergeTinySections(sections: AnnotatedSection[], minLength: number): AnnotatedSection[] {
  if (sections.length <= 1) return sections;

  const merged: AnnotatedSection[] = [];
  let buffer: AnnotatedSection | null = null;

  const lenOf = (s: AnnotatedSection) => s.lines.map(l => l.text).join('\n').length;

  for (const section of sections) {
    if (buffer) {
      if (lenOf(section) < minLength) {
        buffer.lines.push(...section.lines);
      } else if (lenOf(buffer) < minLength) {
        buffer.lines.push(...section.lines);
        merged.push(buffer);
        buffer = null;
      } else {
        merged.push(buffer);
        buffer = section;
      }
    } else if (lenOf(section) < minLength) {
      buffer = { lines: [...section.lines], section_name: section.section_name };
    } else {
      merged.push(section);
    }
  }

  if (buffer) {
    if (merged.length > 0 && lenOf(buffer) < minLength) {
      merged[merged.length - 1].lines.push(...buffer.lines);
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
    const advance = chunk.length - overlap;
    // Always advance strictly forward. Without this, a section shorter than
    // chunkSize (so the breakpoint path is skipped) would loop forever once
    // the overlap consumes the net advance.
    start += advance > 0 ? advance : chunk.length;

    if (end >= text.length) break;
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
