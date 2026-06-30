import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  classifyJudgeUnavailableReason,
  buildJudgeUnavailableMarker,
  JUDGE_UNAVAILABLE_PREFIX,
} from "./judgeDiagnostics.ts";

// Pure, deterministic mapping of a transport/parse error → a judge-unavailable
// reason, plus the audit marker written to validation_patterns_matched on the
// fail-open path. No model, no I/O — run via `deno test --allow-env`. This is
// the observability core of the judge fail-open: it lets /admin/ai-audit and the
// eval audit query attribute WHY the blocking judge produced no verdict (see P5,
// correlation_id 79dfbb96-c5c4-494e-99d8-740bd421bf11) WITHOUT changing fail-open
// behavior (the answer is still served unmodified; judge_verdict stays null).

// ── classifyJudgeUnavailableReason ──────────────────────────────────────────

Deno.test("AbortError (name) → timeout", () => {
  const err = new DOMException("The signal has been aborted", "AbortError");
  assertEquals(classifyJudgeUnavailableReason(err), "timeout");
});

Deno.test("error whose message contains 'aborted' → timeout", () => {
  assertEquals(
    classifyJudgeUnavailableReason(new Error("The operation was aborted")),
    "timeout",
  );
});

Deno.test("SyntaxError from a real JSON.parse failure → invalid_json", () => {
  let caught: unknown;
  try {
    JSON.parse("{ not valid json");
  } catch (e) {
    caught = e;
  }
  assertEquals(classifyJudgeUnavailableReason(caught), "invalid_json");
});

Deno.test("generic Error → error", () => {
  assertEquals(classifyJudgeUnavailableReason(new Error("gateway exploded")), "error");
});

Deno.test("non-Error inputs (null / string / undefined) → error", () => {
  assertEquals(classifyJudgeUnavailableReason(null), "error");
  assertEquals(classifyJudgeUnavailableReason("boom"), "error");
  assertEquals(classifyJudgeUnavailableReason(undefined), "error");
});

// ── buildJudgeUnavailableMarker ─────────────────────────────────────────────

Deno.test("buildJudgeUnavailableMarker → JUDGE_UNAVAILABLE:<reason> for every reason", () => {
  assertEquals(buildJudgeUnavailableMarker("timeout"), "JUDGE_UNAVAILABLE:timeout");
  assertEquals(buildJudgeUnavailableMarker("gateway_error"), "JUDGE_UNAVAILABLE:gateway_error");
  assertEquals(buildJudgeUnavailableMarker("empty_response"), "JUDGE_UNAVAILABLE:empty_response");
  assertEquals(buildJudgeUnavailableMarker("invalid_json"), "JUDGE_UNAVAILABLE:invalid_json");
  assertEquals(buildJudgeUnavailableMarker("error"), "JUDGE_UNAVAILABLE:error");
});

Deno.test("marker carries the prefix and is distinct from existing judge markers", () => {
  const marker = buildJudgeUnavailableMarker("timeout");
  assert(marker.startsWith(`${JUDGE_UNAVAILABLE_PREFIX}:`));
  // The marker shares the validation_patterns_matched column with these inline
  // index.ts markers; it must not collide with (or prefix-shadow) either.
  assert(marker !== "JUDGE_FULL_BLOCK");
  assert(marker !== "JUDGE_UNGROUNDED_WARNING");
  assert(!marker.startsWith("JUDGE_FULL_BLOCK"));
  assert(!marker.startsWith("JUDGE_UNGROUNDED_WARNING"));
});
