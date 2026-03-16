# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev          # Vite dev server on :8080
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright E2E (~210 tests, sequential, 1 worker)
```

Pre-commit hook (husky): runs `lint` then `typecheck`. lint-staged runs `eslint --max-warnings 0` on `*.{ts,tsx}`.

Run a single unit test: `npx vitest run src/path/to/file.test.ts`
Run a single E2E spec: `npx playwright test e2e/specs/dashboard.spec.ts`

E2E tests require `.env.test` with Supabase credentials. Tests run sequentially (`workers: 1`) to avoid auth/feature-flag race conditions.

## Supabase Edge Function Deployment

```bash
supabase functions deploy <function-name> --project-ref <ref>
```

Staging ref: `fgemfxhwushaiiguqxfe` | Production ref: `dlrhobkrjfegtbdsqdsa`

## Architecture Overview

**Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui (Radix primitives)

**Backend**: Supabase (Postgres + Auth + Storage + Edge Functions + Realtime). No custom backend server.

**State management**: `@tanstack/react-query` for server state, React Context for cross-cutting concerns (auth, tenant, impersonation). No Redux/Zustand.

### Routing (App.tsx)

Three layout zones with different provider wrapping:
- **Tenant routes** (`/dashboard`, `/jobs`, etc.): wrapped in `TenantProvider` + `SubscriptionStatusBanner`. Protected by `RoleGuard` with allowed roles.
- **Portal routes** (`/portal/*`): wrapped in `PortalAuthProvider`. Separate customer-facing auth flow.
- **Admin routes** (`/admin/*`): no TenantProvider. Uses `AdminLayout`. Platform admin auth only.

All pages except Landing are lazy-loaded via `React.lazy`.

### Auth & Tenant System

- `AuthContext`: Supabase auth session, sets listener first then checks existing session.
- `TenantContext`: loads tenant + tenantUser + role with exponential backoff retry. `useEffect` depends on `userId` (string), NOT `user` (object reference). Do NOT reset `retryCountRef` after successful query.
- `checkIsPlatformAdmin()` uses `supabase.rpc("is_platform_admin")` — NOT a profiles query.
- `platform_admins` table: upsert requires BOTH `user_id` AND `email` (email is NOT NULL).

### Feature Access (Two Layers)

1. **Subscription tier gating** (`FeatureGate` + `useFeatureAccess`): checks tenant tier against `TIER_CONFIG` in `src/config/pricing.ts`.
2. **Runtime feature flags** (`FeatureFlagGate` + `useFeatureFlags`): reads `feature_flags` DB table with allowlist/blocklist/rollout percentage (consistent tenant hashing).

### Toast Systems

Two toast systems coexist: shadcn/ui Radix (`useToast()` from `@/hooks/use-toast`) AND Sonner (`toast` from `sonner`). Both `<Toaster />` and `<Sonner />` are mounted in App.tsx.

## Supabase Edge Functions (47 total)

All functions are Deno-based in `supabase/functions/`. Shared utilities in `_shared/`.

### Sentinel AI Pipeline (`field-assistant/`)

19-file modular pipeline (~6,100 LOC):
```
auth → policy → feature flags → rate limiting → retrieval (RAG/pgvector) →
compliance (deterministic rules) → graph (equipment knowledge graph) →
diagnosticSignals → patternAdvisory → contextFusion → prompt →
OpenAI API (via aiClient circuit breaker) → validation (injection detection) →
judge (LLM-as-judge) → audit
```

7 feature flags: `rag_judge`, `rag_reranking`, `compliance_engine`, `equipment_graph`, `judge_blocking_mode`, `judge_full_blocking`, `diagnostic_learning`.

### Document Pipeline

`extract-document-text` extracts text (local PDF parsing via unpdf, falls back to OpenAI vision for scanned/image PDFs), then generates embeddings inline via `EdgeRuntime.waitUntil()` background task. Processes one chunk at a time using raw REST API calls.

`generate-embeddings` is kept as standalone for manual re-embedding/retry. Uses raw REST (no supabase-js SDK) to minimize heap usage.

Shared chunking logic in `_shared/chunking.ts`. AI gateway client with circuit breaker + fallback in `_shared/aiClient.ts`.

### Edge Function Patterns

- CORS: all functions handle OPTIONS preflight with `corsHeaders` object.
- Auth: most functions verify JWT via `supabase.auth.getUser()` or raw GoTrue API.
- `supabase/config.toml` lists functions with `verify_jwt = false` (webhooks, public endpoints).
- `AI_GATEWAY_URL` env var set to `https://api.openai.com/v1` on staging to bypass Lovable gateway.

## Database

133+ SQL migrations in `supabase/migrations/`. RLS enabled on all tables.

Key enums: `app_role` (owner/admin/dispatcher/technician/client), `subscription_tier`, `job_status`, `job_priority`, `industry_type`.

Core tables: `tenants`, `tenant_users`, `profiles`, `platform_admins`, `feature_flags`, `documents`, `document_chunks`.

## E2E Test Architecture

- `e2e/global-setup.ts`: DB-only seeding (runs BEFORE webServer starts — no browser code here).
- `e2e/setup/auth.setup.ts`: Browser UI login flows to save 4 auth states to `.playwright/auth/`.
- Page Object Model in `e2e/page-objects/`.
- Helpers in `e2e/helpers/` (supabase-admin, ai-seed, feature-flag, etc.).
- 8 Playwright projects: setup, chromium-admin, chromium-auth, chromium-portal, chromium-platform-admin, chromium-ai-chat, chromium-ai-admin, chromium-ai-pipeline.

## Path Aliases

`@/*` maps to `src/*` (configured in tsconfig and vite).

Import Supabase client: `import { supabase } from "@/integrations/supabase/client"`.

Auto-generated DB types: `src/integrations/supabase/types.ts` — do not edit manually.
