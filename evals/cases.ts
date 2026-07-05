import type { EvalCase } from "./types";
import {
  LESSON_QUESTION,
  LESSON_DOCUMENT_NAME,
  LESSON_CHUNK_INCLUDES,
  LESSON_EXPECTED_FACTS,
  LESSON_ONLY_DOCUMENT_NAMES,
} from "./lessonCorpus";

// First benchmark set for the Sentinel AI eval harness (PR-2.1).
//
// Reuses the fixture-backed HVAC corpus seeded by e2e/helpers/ai-seed-helpers
// (Carrier 24ACC636 manual, HVAC maintenance guide, warranty terms), so the
// harness needs NO new embeddings and runs against the same documents the E2E
// suite already validates.
//
// Two case types are covered here: `manual` (answerable from an uploaded doc)
// and `must_abstain` (unsupported by the corpus — a confident answer is a
// failure). `equipment_history` / `service_history` cases are a documented
// follow-up (they need a richer seeded equipment_registry + job history); the
// scorer already supports those types.

const HVAC = { industry: "hvac" } as const;
const CARRIER = {
  industry: "hvac",
  equipment: { equipment_type: "Air Handler", brand: "Carrier", model: "24ACC636" },
} as const;

export const BENCHMARK_CASES: EvalCase[] = [
  // ── Manual (answerable) ──────────────────────────────────────
  {
    id: "EV-M-001",
    type: "manual",
    question: "What is the startup procedure for the Carrier 24ACC636?",
    context: CARRIER,
    expectedSources: {
      documentNames: ["Carrier 24ACC636 Installation Manual"],
      chunkIncludes: ["startup"],
    },
    expectedFacts: ["thermostat", "disconnect"],
  },
  {
    id: "EV-M-002",
    type: "manual",
    question: "What are the operating temperature limits for the Carrier 24ACC636?",
    context: CARRIER,
    expectedSources: {
      documentNames: ["Carrier 24ACC636 Installation Manual"],
      chunkIncludes: ["operating temperature"],
    },
    expectedFacts: ["65", "85"],
  },
  {
    id: "EV-M-003",
    type: "manual",
    question: "How do I check the refrigerant charge on the Carrier 24ACC636?",
    context: CARRIER,
    expectedSources: {
      documentNames: ["Carrier 24ACC636 Installation Manual"],
      chunkIncludes: ["refrigerant"],
    },
    expectedFacts: ["manifold", "subcooling"],
  },
  {
    id: "EV-M-004",
    type: "manual",
    question: "What is the air filter replacement schedule?",
    context: HVAC,
    expectedSources: {
      documentNames: ["HVAC Maintenance Best Practices"],
      chunkIncludes: ["filter"],
    },
    expectedFacts: ["90 days", "60 days"],
  },
  {
    id: "EV-M-005",
    type: "manual",
    question: "What are the recommended maintenance intervals?",
    context: HVAC,
    expectedSources: {
      documentNames: ["HVAC Maintenance Best Practices"],
      chunkIncludes: ["maintenance interval"],
    },
    expectedFacts: ["quarterly"],
  },
  {
    id: "EV-M-006",
    type: "manual",
    question: "What does the Carrier warranty cover for parts and the compressor?",
    context: HVAC,
    expectedSources: {
      documentNames: ["Warranty Terms - Carrier Equipment"],
      chunkIncludes: ["warranty"],
    },
    expectedFacts: ["5 years", "10 years"],
  },
  // P3b lexical-rescue class: a TERSE, technician-style phrasing (no question
  // scaffolding). Terse queries can embed at/below the semantic floor against
  // the very chunk that literally contains the answer (measured live on the
  // pilot tenant 2026-07-04); the strict lexical rescue path exists for
  // exactly this class. The case passes whether the chunks arrive via the
  // semantic pass or the rescue pass — the assertion is grounded answer +
  // citation, not which retrieval path fired. NOTE: a terse-airflow analog is
  // impossible here (the eval corpus has no airflow spec content) — that
  // proof point stays with the pilot founder-smoke rerun.
  {
    id: "EV-M-007",
    type: "manual",
    question: "filter replacement schedule",
    context: HVAC,
    expectedSources: {
      documentNames: ["HVAC Maintenance Best Practices"],
      chunkIncludes: ["filter"],
    },
    expectedFacts: ["90 days"],
  },

  // ── Must-abstain (unsupported by the corpus) ─────────────────
  // P3b lexical-bait guard: 'Lennox' / 'G61' appear in no corpus chunk, so the
  // strict AND-match can never fire — this case now also proves the lexical
  // rescue path does not weaken abstention (calibrated read-only on the pilot
  // corpus 2026-07-04: zero ts_rank against every chunk).
  {
    id: "EV-A-001",
    type: "must_abstain",
    question: "What is the torque spec for the gas valve on a Lennox G61 furnace?",
    context: HVAC,
    expectAbstain: true,
  },
  {
    id: "EV-A-002",
    type: "must_abstain",
    question: "How do I size a tankless water heater for a three-bathroom house?",
    context: HVAC,
    expectAbstain: true,
  },
  {
    id: "EV-A-003",
    type: "must_abstain",
    question: "What is the recipe for chocolate cake?",
    context: HVAC,
    expectAbstain: true,
  },

  // ── Approved-lesson citation (PR-3c) ─────────────────────────
  // These two require the eval lesson seeded (evals/seed.ts → ensureEvalLessonSeeded)
  // AND lesson_citations enabled for the eval tenant — both deferred, gated steps.
  // Offline (--self-test) and the original baseline are unaffected.
  //
  // An approved, published lesson is retrieved and cited as the ONLY supporting
  // source. The topic is corpus-absent, so onlyDocumentNames asserts no manual/
  // warranty document contributes — proving the lesson stands alone.
  {
    id: "EV-LESSON-001",
    type: "manual",
    question: LESSON_QUESTION,
    context: HVAC,
    expectedSources: {
      documentNames: [LESSON_DOCUMENT_NAME],
      chunkIncludes: LESSON_CHUNK_INCLUDES,
      onlyDocumentNames: LESSON_ONLY_DOCUMENT_NAMES,
    },
    expectedFacts: LESSON_EXPECTED_FACTS,
  },
  // Abstain still holds: a question neither the HVAC corpus nor the published
  // lesson supports must abstain — proving lessons do not weaken the gate.
  // P3b lexical-bait guard (Trane XR16): 'Trane' / 'XR16' appear in no corpus
  // chunk, so the strict AND-match can never rescue for this query — this
  // case doubles as the Trane-bait proof that lexical rescue does not weaken
  // abstention (OR/partial matching is deliberately unimplemented).
  {
    id: "EV-LESSON-ABSTAIN-001",
    type: "must_abstain",
    question: "What is the low-pressure cutout setting for a Trane XR16 heat pump?",
    context: HVAC,
    expectAbstain: true,
  },
];
