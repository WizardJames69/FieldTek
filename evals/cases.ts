import type { EvalCase } from "./types";

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

  // ── Must-abstain (unsupported by the corpus) ─────────────────
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
];
