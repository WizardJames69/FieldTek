# PR-SEC-7 — Stacked-modifier prompt-injection detection gap

Discovered while wiring the edge-function Deno suite into CI for PR-TEST-3: a pre-existing
`field-assistant/index.test.ts` case (`sanitizeExtractedText - detects 'ignore previous
instructions'`) had been failing since it was written. Root-causing it surfaced a **real
detection gap in production code**, not just a stale test.

## Root cause

The `ignore` / `disregard` injection regexes matched only a **single** modifier word between the
verb and the instruction-noun:

```
/ignore\s+(previous|all|any|above|prior)\s+(instructions?|prompts?|rules?|guidelines?)/gi
```

So `ignore previous instructions` matched, but `ignore all previous instructions` — two stacked
modifiers, the single most common jailbreak phrasing — did **not**. Verified empirically against
the live patterns:

| Input | Before | After |
|---|---|---|
| `ignore previous instructions` | DETECTED | DETECTED |
| `ignore all previous instructions` | **MISSED** | DETECTED |
| `disregard all prior rules` | **MISSED** | DETECTED |
| `ignore any above guidelines` | **MISSED** | DETECTED |
| `ignore the manual` (benign) | not detected | not detected |

The identical regex lived in two independent places, both fixed:
- `supabase/functions/field-assistant/constants.ts:119-120` — `PROMPT_INJECTION_PATTERNS[0..1]`,
  used by `detectPromptInjection` on **user input** (`index.ts:304`) and on **retrieved document
  chunks** (`index.ts:810`, `index.ts:880`).
- `supabase/functions/extract-document-text/index.ts:314-315` — `DOCUMENT_INJECTION_PATTERNS[0..1]`,
  used by `sanitizeExtractedText` during document ingestion.

## Fix

Allow one or more stacked modifiers:

```
/ignore\s+((?:previous|all|any|above|prior)\s+)+(instructions?|prompts?|rules?|guidelines?)/gi
```

The non-capturing group `(?:…)\s+` repeated with `+` matches any run of modifiers while still
requiring the trailing instruction-noun, so benign phrases like `ignore the manual` remain
undetected (no false positive). Same change applied to the `disregard` pattern in both files.

## Severity

`detectPromptInjection` is a **defense-in-depth control** — it returns a 400 on recognised
jailbreak strings — layered atop retrieval grounding (abstain when unsupported), the LLM judge,
and citation validation. A string that evaded it was not an automatic bypass; the system prompt and
grounding still constrained output. This closes a **control weakness** (the canonical jailbreak
phrasing silently passed a security filter), not a demonstrated end-to-end exploit. It is a
content-safety detection gap, distinct from the object-level authorization gaps closed in PR-SEC-5 /
PR-SEC-6.

## Tests

`supabase/functions/field-assistant/injectionPatterns.test.ts` exercises the **real**
`detectPromptInjection` (not an inline mirror) — the drift between an inline mirror and the real
patterns is exactly what hid this for months. It asserts detection of stacked-modifier forms and
single-modifier forms, and non-detection of benign phrasing. `extract-document-text`'s
`sanitizeExtractedText` is not independently Deno-unit-testable today (its module initialises an
OpenAI client and `serve()` at import), so its identical regex is covered by the shared behavioural
proof here plus the two-line diff.

## Deployment

Repository-only in this pass. Taking the fix live requires a later founder-approved redeploy of both
`field-assistant` and `extract-document-text` to `fgemfxhwushaiiguqxfe`. No migration.
