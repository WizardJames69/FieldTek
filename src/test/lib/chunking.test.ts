import { describe, it, expect } from 'vitest';

// The chunker lives under supabase/functions/_shared because it's shared with
// Deno edge functions, but it is pure ES-module TypeScript and importable
// from Vitest. Keeping the test under src/test so `npm run test` picks it up.
import {
  chunkTextStructured,
  chunkTextStructuredWithStats,
  estimateTokens,
  MAX_CHUNKS,
} from '../../../supabase/functions/_shared/chunking';

describe('chunkTextStructured — page markers', () => {
  it('stamps each chunk with the active page number', () => {
    const text = [
      '[[PAGE:1]]',
      '',
      'Install procedure for the XV20i compressor module. The unit ships with',
      'standard mounting hardware and a factory-fitted sight glass. Verify that',
      'the unit has arrived with all packaging intact and no visible damage.',
      '',
      '[[PAGE:2]]',
      '',
      '## Step-by-step wiring',
      '1. De-energize the circuit at the main breaker.',
      '2. Verify zero voltage using a calibrated multimeter.',
      '3. Route conductors through the supplied strain relief.',
      '',
      '[[PAGE:3]]',
      '',
      'Troubleshooting guide for error codes. If the compressor trips on fault',
      'code 184, inspect the low-pressure cutout switch and the suction line',
      'temperature sensor before escalating to a full charge verification.',
    ].join('\n');

    const chunks = chunkTextStructured(text);

    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.text).not.toMatch(/\[\[PAGE:/);
    }

    const pages = chunks.map((c) => c.page_number);
    expect(pages).toContain(1);
    expect(pages).toContain(2);
    expect(pages).toContain(3);
  });

  it('stays on the earlier page when a section spans a page boundary', () => {
    const text = [
      '[[PAGE:4]]',
      '',
      'Continuous narrative section that begins on page four and runs into',
      'page five. It should be treated as one logical section, and because',
      'the section started on page four, all resulting chunks carry page 4.',
      '[[PAGE:5]]',
      'Additional narrative continuing without any structural break, still the',
      'same paragraph topic. The chunker should keep this rolled into the',
      'prior section since there is no blank line or heading between them.',
    ].join('\n');

    const chunks = chunkTextStructured(text);
    expect(chunks.length).toBeGreaterThan(0);
    // The section starts on page 4; the chunker stamps section-level pages.
    expect(chunks[0].page_number).toBe(4);
  });
});

describe('chunkTextStructured — section names', () => {
  it('captures markdown headings as section_name', () => {
    const text = [
      '# Installation Guide',
      'Introductory paragraph about the installation overall.',
      '',
      '## Wiring',
      'Details about wiring the unit. Use AWG 10 conductors for the line-side',
      'connections and verify torque with a calibrated torque wrench.',
      '',
      '## Commissioning',
      'Commissioning procedure. Energize the unit and confirm pressures are',
      'within the manufacturer specification before finalizing the install.',
    ].join('\n');

    const chunks = chunkTextStructured(text);
    const sections = new Set(chunks.map((c) => c.section_name).filter(Boolean));

    // The intro section is under 100 chars, so the tiny-section merge folds
    // the Wiring section into it (first section's name wins). Commissioning
    // is long enough to stand alone.
    expect(sections.has('Installation Guide')).toBe(true);
    expect(sections.has('Commissioning')).toBe(true);
  });

  it('persists the nearest preceding heading across all following paragraphs', () => {
    const para = (label: string) =>
      `${label}: this paragraph carries enough characters to stand alone as its ` +
      'own section without being folded into a neighbor by the tiny-section ' +
      'merge pass, so the heading attribution is observable.';

    const text = [
      '## Wiring',
      '',
      para('Para A'),
      '',
      para('Para B'),
      '',
      para('Para C'),
      '',
      '## Commissioning',
      '',
      para('Para D'),
    ].join('\n');

    const chunks = chunkTextStructured(text);

    // Every paragraph under a heading inherits it — not just the first one.
    for (const label of ['Para A', 'Para B', 'Para C']) {
      const chunk = chunks.find((c) => c.text.includes(label));
      expect(chunk, `chunk containing ${label}`).toBeDefined();
      expect(chunk!.section_name, `section_name of ${label}`).toBe('Wiring');
    }
    const after = chunks.find((c) => c.text.includes('Para D'));
    expect(after!.section_name).toBe('Commissioning');
  });
});

describe('chunkTextStructured — classification', () => {
  it('classifies pipe tables as type=table', () => {
    const text = [
      '## Fault codes',
      '',
      '| Code | Description              | Action                  |',
      '| ---- | ------------------------ | ----------------------- |',
      '| 184  | Low pressure cutout      | Check suction line      |',
      '| 186  | High head pressure       | Clean condenser coil    |',
      '| 210  | Loss of charge           | Leak-check & recharge   |',
    ].join('\n');

    const chunks = chunkTextStructured(text);
    expect(chunks.some((c) => c.type === 'table')).toBe(true);
  });

  it('classifies numbered procedures as type=procedure', () => {
    const text = [
      '## Leak check procedure',
      '1. De-energize and recover refrigerant per EPA 608.',
      '2. Pressurize the system with dry nitrogen to 150 psig.',
      '3. Apply soap bubble solution to every joint.',
      '4. Mark any joint that bubbles for rework.',
      '5. Release nitrogen, rework, and re-test.',
    ].join('\n');

    const chunks = chunkTextStructured(text);
    expect(chunks.some((c) => c.type === 'procedure')).toBe(true);
  });
});

describe('chunkTextStructured — safety guards', () => {
  it('drops chunks shorter than 50 chars', () => {
    const text = 'Hi.\n\nShort.';
    const chunks = chunkTextStructured(text);
    // Both lines are under 50 chars — nothing should come through.
    expect(chunks.every((c) => c.text.length > 50)).toBe(true);
  });

  it('caps output at 500 chunks for runaway inputs', () => {
    // Build an input with many short paragraph sections, each long enough
    // to become its own chunk after the blank-line boundary. Keep it small
    // enough to not OOM the test runner but large enough to exceed 500.
    const sentence = 'This is a narrative sentence of sufficient length to clear the 50-char floor set by the chunker and contribute to chunk counts. ';
    const paragraphs: string[] = [];
    for (let i = 0; i < 700; i++) {
      paragraphs.push(`${sentence}${sentence}Paragraph ${i}.`);
    }
    const bigText = paragraphs.join('\n\n');
    const chunks = chunkTextStructured(bigText);
    expect(chunks.length).toBeLessThanOrEqual(500);
  });
});

describe('chunkTextStructuredWithStats — capping stats (PR-1.1)', () => {
  const bigSentence =
    'This is a narrative sentence of sufficient length to clear the 50-char floor set by the chunker and contribute to chunk counts. ';

  function manyParagraphs(n: number): string {
    const paragraphs: string[] = [];
    for (let i = 0; i < n; i++) {
      paragraphs.push(`${bigSentence}${bigSentence}Paragraph ${i}.`);
    }
    return paragraphs.join('\n\n');
  }

  it('reports cappedAtMax + the real pre-cap count when over MAX_CHUNKS', () => {
    const { chunks, rawChunkCount, cappedAtMax } = chunkTextStructuredWithStats(
      manyParagraphs(700),
    );
    expect(cappedAtMax).toBe(true);
    expect(chunks.length).toBe(MAX_CHUNKS);
    expect(rawChunkCount).toBeGreaterThan(MAX_CHUNKS);
  });

  it('does not flag capping for a small document', () => {
    const { chunks, rawChunkCount, cappedAtMax } = chunkTextStructuredWithStats(
      manyParagraphs(5),
    );
    expect(cappedAtMax).toBe(false);
    expect(rawChunkCount).toBe(chunks.length);
    expect(chunks.length).toBeLessThanOrEqual(MAX_CHUNKS);
  });

  it('chunkTextStructured stays backward-compatible with the stats variant', () => {
    const text = manyParagraphs(60);
    expect(chunkTextStructured(text).length).toBe(
      chunkTextStructuredWithStats(text).chunks.length,
    );
  });
});

describe('estimateTokens', () => {
  it('estimates roughly chars/4', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
    expect(estimateTokens('')).toBe(0);
  });
});
