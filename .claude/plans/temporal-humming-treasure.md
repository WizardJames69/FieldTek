# Fix DiagnosticWizard test IDs to match hvac-* prefix convention

## Context
`src/config/industryAssistantConfig.ts` now uses `hvac-` prefixed IDs for HVAC diagnostic paths (`hvac-electrical`, `hvac-noise`, `hvac-pressure`). The `not-cooling` path ID is unchanged. Three unit test expectations in `DiagnosticWizard.test.tsx` still reference the old un-prefixed IDs.

## Changes

**File:** `src/test/components/DiagnosticWizard.test.tsx`

Three edits in the `getDiagnosticPath` describe block:

| Line | Old | New |
|------|-----|-----|
| 62 | `expect(path?.id).toBe("electrical")` | `expect(path?.id).toBe("hvac-electrical")` |
| 68 | `expect(path?.id).toBe("noise")` | `expect(path?.id).toBe("hvac-noise")` |
| 74 | `expect(path?.id).toBe("pressure")` | `expect(path?.id).toBe("hvac-pressure")` |

No production code changes.

## Verification
```bash
npx vitest run src/test/components/DiagnosticWizard.test.tsx
npm test   # full suite
```
