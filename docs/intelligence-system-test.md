# Intelligence System — Local Testing Guide

This document describes how to test the full workflow intelligence pipeline locally, including pattern discovery, context fusion, and Sentinel AI prompt construction.

## Prerequisites

- Supabase CLI installed (`supabase --version`)
- Node.js 18+ with `npx` available
- `tsx` installed globally or via `npx`

## 1. Reset Database

```bash
supabase db reset
```

This drops and recreates all tables, applies all migrations in order.

## 2. Push Migrations

If working against a remote project instead of local:

```bash
supabase db push
```

## 3. Verify Intelligence Schema

Confirm all 9 intelligence tables exist:

```bash
psql "$DATABASE_URL" < scripts/verify-intelligence-schema.sql
```

Expected output:
```
NOTICE:  All 9 intelligence tables verified successfully.
NOTICE:    OK: workflow_templates
NOTICE:    OK: workflow_template_steps
...
```

## 4. Run Edge Functions Locally

```bash
supabase functions serve
```

This starts all edge functions on `http://localhost:54321/functions/v1/`.

## 5. Run Frontend Dev Server

```bash
npm run dev
```

Access the admin UI at `http://localhost:8080/admin/workflow-discovery`.

## 6. Trigger Pattern Discovery

```bash
curl -X POST http://localhost:54321/functions/v1/suggest-workflow-patterns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"tenant_id": "YOUR_TENANT_ID"}'
```

Expected response:
```json
{
  "success": true,
  "clusters_found": 3,
  "suggestions_created": 2,
  "latency_ms": 450
}
```

## 7. Run Intelligence Pipeline Test Harness

```bash
SUPABASE_URL=http://localhost:54321 \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
npx tsx scripts/test-intelligence-pipeline.ts
```

This will:
1. Insert synthetic diagnostic statistics, step statistics, and pattern clusters
2. Run the context fusion algorithm locally
3. Print ranked diagnostic hypotheses
4. Verify sorting, dampening, normalization, and source attribution
5. Clean up all test data

## 8. Verify Sentinel Prompt Sections

When all intelligence modules are active, the Sentinel system prompt includes these sections in order:

1. `## WORKFLOW EXECUTION CONTEXT` — current step, completed steps, historical outcomes
2. `### Historical Step Intelligence` — per-step success rates from `workflow_step_statistics`
3. `## DIAGNOSTIC LEARNING CONTEXT` — symptom→failure→repair patterns
4. `## WORKFLOW PATTERN ADVISORY` — AI-discovered repair patterns from clusters
5. `## DIAGNOSTIC HYPOTHESES (FUSED INTELLIGENCE)` — ranked cross-signal hypotheses

## 9. Verify Build

```bash
npx tsc --noEmit   # TypeScript compilation check
npm run build       # Production build
```

Both should pass with zero errors.
