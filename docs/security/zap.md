# OWASP ZAP — Local Passive Baseline Scan

FieldTek uses [OWASP ZAP](https://www.zaproxy.org/) for lightweight, **local-only**
web security scanning of the built frontend. This first iteration is deliberately
**passive, local, and non-blocking**: it crawls the production bundle served by
`vite preview` and reports passively-observed issues (missing security headers,
cookie flags, information disclosure in responses, etc.). It does **not** attack
anything, and it does **not** touch hosted infrastructure.

> **TL;DR:** `npm run security:zap:baseline` builds the app, serves it on
> `http://127.0.0.1:4173`, and runs the ZAP **baseline** scan (passive + AJAX
> spider) in Docker. Reports land in `security-reports/zap/` (git-ignored).

---

## Passive baseline vs. active scan

| | **Passive baseline** (this PR) | **Active / full scan** (NOT included) |
|---|---|---|
| What it does | Spiders the app and inspects responses with passive rules | Sends crafted **attack payloads** (SQLi, XSS, injection, path traversal, …) |
| Traffic | Ordinary GET/navigation requests only | Malicious/fuzzing requests, many of them |
| Risk to target | Effectively none — it only reads what the app already serves | Can corrupt data, trigger side effects, or **DoS** the target |
| Tool entry point | `zap-baseline.py` | `zap-full-scan.py` / active scan policies |
| Allowed against | The **local** `vite preview` build only | **Nothing** in this repo's tooling yet (future, local-stack only) |

The script runs **`zap-baseline.py`**, which is passive by construction. The
AJAX spider (`-j`) is enabled so ZAP can crawl the client-rendered React SPA, but
the AJAX spider only *navigates* the app — it still performs **no active attacks**.

## Why hosted Supabase / Vercel must never be active-scanned

The scan target is hardcoded to the local preview and the script refuses to run
against anything else. This is not just a style preference:

- **Authorization.** Active scanning sends attack traffic. Running it against
  infrastructure you do not own — or do not have **explicit written
  authorization** to test — is unauthorized access. Hosted Supabase
  (`fgemfxhwushaiiguqxfe.supabase.co` or any project) and Vercel production are
  **shared, managed services**.
- **Provider terms.** Supabase, Vercel, AWS, and similar providers prohibit
  unauthorized penetration testing / active scanning of their platforms in their
  acceptable-use terms. Some require a formal pentest request first.
- **Blast radius.** Active scans can create/modify/delete data through real API
  endpoints, exhaust rate limits, trip abuse protection, page on-call, or cause
  an outage for real tenants. A passive baseline against a throwaway local build
  has none of those consequences.
- **It wouldn't even be meaningful.** Most of what a passive baseline flags
  (security headers, CSP, cookie attributes) is determined by the **frontend
  build + hosting config**, which we can inspect locally without ever sending a
  packet to production.

**Therefore:** never point any ZAP scan in this repo at
`*.supabase.co`, any hosted Supabase project, Vercel production, or any
third-party host. The script enforces a loopback-only allowlist and an explicit
hosted-infra denylist and will abort if either is violated.

## How to run the local scan

### Prerequisites

1. **Docker** installed and **running** (Docker Desktop on macOS/Windows, or a
   local engine on Linux). The scan runs ZAP from the official
   `ghcr.io/zaproxy/zaproxy:stable` image.
2. Repo dependencies installed (`npm ci` / `npm install`).
3. Port **4173** free on `127.0.0.1`.

### Run it

```bash
npm run security:zap:baseline
# or, equivalently:
bash scripts/security-zap-baseline.sh
```

The script will:

1. `npm run build` — produce the production bundle in `dist/`.
2. Start `vite preview` bound to **`127.0.0.1:4173`** (loopback only,
   `--strictPort` so it never silently moves ports).
3. Wait until the preview answers.
4. Run `zap-baseline.py` (passive) with the AJAX spider enabled, targeting the
   local preview via the Docker host gateway (`host.docker.internal:4173`).
5. Write HTML / Markdown / JSON reports to `security-reports/zap/`.
6. **Always** stop the preview server on exit (success, failure, or Ctrl-C).

### Reading the results

Reports are written to **`security-reports/zap/`** (git-ignored — they are local
artifacts, never committed):

- `zap-baseline-<timestamp>.html` — human-readable report.
- `zap-baseline-<timestamp>.md` — Markdown summary.
- `zap-baseline-<timestamp>.json` — machine-readable alerts.
- `preview.log` — captured `vite preview` output (for debugging startup).

The baseline is **informational and non-blocking**: it exits `0` even when it
finds WARN-level alerts (`-I`), and a FAIL-level alert is surfaced as a warning
in the log rather than aborting the run.

### Security headers are set at the hosting layer, not by `vite preview`

The baseline's header-hygiene findings (CSP not set, missing anti-clickjacking,
etc.) are response-header concerns owned by the **production hosting layer**, not
by the app bundle. They are configured in [vercel.json](../../vercel.json) under
`headers` (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options,
Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy).

**Important:** `vite preview` — the local target this baseline scans — does **not**
read `vercel.json` and does **not** emit those headers. So re-running this local
passive baseline will **still report** the header findings even though they are
fixed in production. That is expected: the local preview is only the static
bundle, while the headers are added by Vercel at the edge. Validate the headers
against the **deployed** site instead, e.g. `curl -sI https://<deploy-host>/`
(your own, authorized deployment — never an active scan, and never against a
host you are not authorized to test).

Sub-Resource Integrity (SRI) for Google Fonts and Google Tag Manager is
**deliberately not added**: those endpoints rotate their content, so a pinned
hash would break fonts/analytics on the next upstream change. The durable fix is
to self-host fonts and/or drop GTM if unused — tracked as future work, not done
here.

### Why `host.docker.internal` is an allowed preview host

ZAP runs inside Docker, so it cannot reach the host's preview as `127.0.0.1`
(that address is the container itself). It reaches the host via the Docker
gateway alias **`host.docker.internal:4173`**. Vite's `preview` server has
DNS-rebinding protection (`allowedHosts`) that returns **403 Forbidden** for any
non-loopback `Host` header — which otherwise causes the scan to crawl **0** app
pages (the spider only ever sees 403s). To let the local Docker-to-host scan
through, [vite.config.ts](../../vite.config.ts) adds exactly one entry:

```ts
preview: { allowedHosts: ["host.docker.internal"] }
```

This is **local-only and safe**: it adds a single hostname — it does **not** set
`allowedHosts: true` and does **not** disable the protection — and `vite preview`
is never used in production (Vercel serves the static `dist/` build), so there is
no production, hosting, or Vercel impact. The scan target stays local: the
browser/preview is `http://127.0.0.1:4173` and the ZAP container reaches it at
`http://host.docker.internal:4173`. The script's denylist still blocks
`*.supabase.co`, known Supabase project refs, and `vercel.app` / `.com` / `.sh`.

### Tuning (environment variables)

All optional; sensible local-only defaults are baked in:

| Variable | Default | Purpose |
|---|---|---|
| `ZAP_PREVIEW_HOST` | `127.0.0.1` | Host the preview binds to (must stay loopback). |
| `ZAP_PREVIEW_PORT` | `4173` | Preview port. |
| `ZAP_IMAGE` | `ghcr.io/zaproxy/zaproxy:stable` | ZAP Docker image. |
| `ZAP_SPIDER_MINUTES` | `2` | Minutes for the traditional spider. |
| `ZAP_STARTUP_TIMEOUT` | `90` | Seconds to wait for the preview to come up. |

### Linux note

On native Linux, `host.docker.internal` is provided via the
`--add-host=host.docker.internal:host-gateway` flag (already in the script). If
the container still cannot reach the preview, bind the preview to all interfaces
for the duration of the scan with `ZAP_PREVIEW_HOST=0.0.0.0` (it remains a
transient local-only dev server). On Docker Desktop (macOS/Windows) the default
loopback bind works as-is.

## Scope of this first PR

This PR is **intentionally minimal and safe**:

- ✅ Local passive baseline scan against the `vite preview` build.
- ✅ AJAX spider enabled for the SPA.
- ✅ Reports git-ignored.
- ✅ Optional `npm run security:zap:baseline` convenience script.
- ✅ **Non-blocking** — it is **not** wired into CI as a required gate.

It deliberately does **not** include:

- ❌ Active/full attack scanning (`zap-full-scan.py`, active scan policies).
- ❌ Authenticated scanning or any token-minting helper.
- ❌ Scanning of hosted Supabase, Vercel production, or any third-party host.
- ❌ A CI blocking gate.

## Future work

Tracked as deliberate, separately-reviewed follow-ups — **none** of them change
the rule above (never active-scan hosted/third-party infra):

1. **Authenticated baseline.** Drive a logged-in session against the **local**
   stack so passive rules see authenticated pages. Requires a safe, local-only
   credential/session strategy — explicitly *not* a production token helper.
2. **Active scan against a fully local stack.** An active (attack) scan is only
   ever acceptable against a disposable, **locally-run** backend (e.g. local
   Supabase via the CLI) that contains no real data — never against a hosted
   project.
3. **CI integration as a non-blocking report.** Optionally run the baseline in
   CI and publish the report as an artifact, starting non-blocking and only
   later considering a gate once the alert baseline is understood and triaged.
4. **Alert triage / baseline file.** Maintain a reviewed list of accepted/known
   alerts so new findings stand out.
