#!/usr/bin/env bash
#
# security-zap-baseline.sh — Safe, LOCAL-ONLY OWASP ZAP passive baseline scan.
# =============================================================================
# Builds the FieldTek frontend, serves the production bundle with `vite preview`
# on a local loopback port, and runs the OWASP ZAP *baseline* scan (passive only,
# with the AJAX spider enabled for the React SPA) against that local preview.
#
# This is intentionally a PASSIVE BASELINE scan:
#   * It spiders the app and runs ZAP's PASSIVE rules against the responses.
#   * It NEVER sends active attack payloads (no SQLi/XSS/injection probing).
#   * It targets ONLY the local Vite preview (http://127.0.0.1:4173).
#
# It MUST NOT be pointed at hosted infrastructure. Active or authenticated
# scanning of hosted Supabase (fgemfxhwushaiiguqxfe.supabase.co or any project),
# Vercel production, or any third-party service is unauthorized and out of scope.
# See docs/security/zap.md for the full safe/unsafe matrix.
#
# Usage:
#   bash scripts/security-zap-baseline.sh
#   npm run security:zap:baseline
#
# Requirements: Docker (running) + a local checkout with dependencies installed.
# Reports are written to security-reports/zap/ (git-ignored).
# =============================================================================

set -euo pipefail

# ── Configuration (local-only by design; override via env for local dev) ─────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Host interface the preview binds to. Loopback by default so the build is NOT
# exposed on the LAN. Must stay local (validated below).
PREVIEW_BIND_HOST="${ZAP_PREVIEW_HOST:-127.0.0.1}"
PREVIEW_PORT="${ZAP_PREVIEW_PORT:-4173}"

# The canonical local target (what we are conceptually scanning).
LOCAL_TARGET_URL="http://${PREVIEW_BIND_HOST}:${PREVIEW_PORT}"

# From INSIDE the ZAP container, the host's preview is reached via the Docker
# host gateway alias, not 127.0.0.1 (which would be the container itself).
ZAP_TARGET_HOST="${ZAP_TARGET_HOST:-host.docker.internal}"
ZAP_TARGET_URL="http://${ZAP_TARGET_HOST}:${PREVIEW_PORT}"

ZAP_IMAGE="${ZAP_IMAGE:-ghcr.io/zaproxy/zaproxy:stable}"
REPORT_DIR="${REPO_ROOT}/security-reports/zap"
SPIDER_MINUTES="${ZAP_SPIDER_MINUTES:-2}"
STARTUP_TIMEOUT="${ZAP_STARTUP_TIMEOUT:-90}"

PREVIEW_PID=""

# ── Small helpers ────────────────────────────────────────────────────────────
log()  { printf '\033[1;34m[zap-baseline]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[zap-baseline] WARNING:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[zap-baseline] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# ── Local-only safety guard ──────────────────────────────────────────────────
# Belt-and-suspenders refusal to ever scan anything that is not the local
# preview. The host must be on the loopback allowlist, and neither the bind host
# nor the target URLs may contain a hosted-infra hostname.
assert_local_only() {
  local allowed_hosts=("127.0.0.1" "localhost" "0.0.0.0")
  local forbidden=(
    "supabase.co" "supabase.com" "supabase.in" "supabase.net"
    "vercel.app" "vercel.com" "vercel.sh"
    "amazonaws.com" "cloudfront.net" "fly.dev" "netlify.app"
    "fgemfxhwushaiiguqxfe" "dlrhobkrjfegtbdsqdsa" "dguurrghlassjshteupf"
  )

  local ok=0 h
  for h in "${allowed_hosts[@]}"; do
    [[ "$PREVIEW_BIND_HOST" == "$h" ]] && ok=1
  done
  [[ "$ok" == "1" ]] || die "Refusing: preview host '${PREVIEW_BIND_HOST}' is not a local loopback host (${allowed_hosts[*]})."

  local needle haystack="${PREVIEW_BIND_HOST} ${LOCAL_TARGET_URL} ${ZAP_TARGET_URL}"
  for needle in "${forbidden[@]}"; do
    case "$haystack" in
      *"$needle"*) die "Refusing: target '${haystack}' references hosted infrastructure ('${needle}'). This script is local-only." ;;
    esac
  done

  # The ZAP container target must resolve to the host gateway (or an explicit
  # loopback), never an arbitrary remote host.
  case "$ZAP_TARGET_HOST" in
    host.docker.internal|127.0.0.1|localhost) : ;;
    *) die "Refusing: ZAP container target host '${ZAP_TARGET_HOST}' is not the Docker host gateway or loopback." ;;
  esac
}

# ── Cleanup: always stop the preview server on exit (success, error, Ctrl-C) ──
cleanup() {
  if [[ -n "$PREVIEW_PID" ]] && kill -0 "$PREVIEW_PID" 2>/dev/null; then
    log "Stopping preview server (pid ${PREVIEW_PID})…"
    kill "$PREVIEW_PID" 2>/dev/null || true
    wait "$PREVIEW_PID" 2>/dev/null || true
  fi
  # Fallback: if anything is still holding the preview port, free it so repeat
  # runs do not collide. Guarded + logged so it is never a silent kill.
  if command -v lsof >/dev/null 2>&1; then
    local lingering
    lingering="$(lsof -ti "tcp:${PREVIEW_PORT}" 2>/dev/null || true)"
    if [[ -n "$lingering" ]]; then
      warn "Freeing lingering listener(s) on port ${PREVIEW_PORT}: ${lingering}"
      # shellcheck disable=SC2086
      kill $lingering 2>/dev/null || true
    fi
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# ── Preconditions ────────────────────────────────────────────────────────────
assert_local_only

command -v docker >/dev/null 2>&1 || die "Docker is required but was not found on PATH."
docker info >/dev/null 2>&1 || die "Docker daemon is not running. Start Docker Desktop (or your engine) and retry."
command -v npm >/dev/null 2>&1 || die "npm is required but was not found on PATH."

mkdir -p "$REPORT_DIR"

log "Repo root:        ${REPO_ROOT}"
log "Scan mode:        PASSIVE baseline + AJAX spider (no active attacks)"
log "Target (host):    ${LOCAL_TARGET_URL}"
log "Target (in ZAP):  ${ZAP_TARGET_URL}"
log "ZAP image:        ${ZAP_IMAGE}"
log "Reports →         ${REPORT_DIR}"

# ── 1. Build the production bundle ───────────────────────────────────────────
log "Building production bundle (npm run build)…"
( cd "$REPO_ROOT" && npm run build )

# ── 2. Serve the build via vite preview (loopback only) ──────────────────────
log "Starting preview on ${PREVIEW_BIND_HOST}:${PREVIEW_PORT} (strict port)…"
(
  cd "$REPO_ROOT" \
    && npm run preview -- --host "$PREVIEW_BIND_HOST" --port "$PREVIEW_PORT" --strictPort
) >"${REPORT_DIR}/preview.log" 2>&1 &
PREVIEW_PID=$!

# ── 3. Wait until the preview answers ────────────────────────────────────────
log "Waiting for preview to become ready (timeout ${STARTUP_TIMEOUT}s)…"
deadline=$(( SECONDS + STARTUP_TIMEOUT ))
until curl -fsS -o /dev/null "$LOCAL_TARGET_URL"; do
  if ! kill -0 "$PREVIEW_PID" 2>/dev/null; then
    warn "Preview log (tail):"; tail -n 20 "${REPORT_DIR}/preview.log" >&2 || true
    die "Preview process exited before becoming ready."
  fi
  if (( SECONDS >= deadline )); then
    die "Preview did not become ready within ${STARTUP_TIMEOUT}s."
  fi
  sleep 1
done
log "Preview is ready at ${LOCAL_TARGET_URL}."

# ── 4. Run the ZAP passive baseline scan (with AJAX spider) ──────────────────
# zap-baseline.py is passive-only by construction. Flags:
#   -t  target URL (the local preview, via the Docker host gateway)
#   -j  ALSO run the AJAX spider (needed to crawl the client-rendered SPA)
#   -m  minutes to run the traditional spider
#   -I  do NOT return a non-zero exit code merely for WARN-level alerts
#       (this PR is intentionally non-blocking / informational)
#   -r/-w/-J  HTML / Markdown / JSON reports, written to /zap/wrk (mounted)
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT_HTML="zap-baseline-${STAMP}.html"
REPORT_MD="zap-baseline-${STAMP}.md"
REPORT_JSON="zap-baseline-${STAMP}.json"

log "Running OWASP ZAP passive baseline (AJAX spider on)…"
set +e
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -v "${REPORT_DIR}:/zap/wrk:rw" \
  "$ZAP_IMAGE" \
  zap-baseline.py \
    -t "$ZAP_TARGET_URL" \
    -j \
    -m "$SPIDER_MINUTES" \
    -I \
    -r "$REPORT_HTML" \
    -w "$REPORT_MD" \
    -J "$REPORT_JSON"
ZAP_EXIT=$?
set -e

# zap-baseline.py exit codes: 0 = clean, 1 = FAIL-level alert(s) present,
# 2 = WARN only (suppressed by -I), 3 = ZAP itself failed to run.
case "$ZAP_EXIT" in
  0) log "ZAP baseline completed: no FAIL-level alerts (exit 0)." ;;
  1) warn "ZAP baseline completed WITH FAIL-level alert(s) (exit 1). Review the report." ;;
  2) log "ZAP baseline completed with WARN-level alerts only (exit 2)." ;;
  *) die "ZAP did not run correctly (exit ${ZAP_EXIT}). See output above; reports may be incomplete." ;;
esac

log "Reports written under ${REPORT_DIR}:"
log "  • ${REPORT_HTML}"
log "  • ${REPORT_MD}"
log "  • ${REPORT_JSON}"
log "Done. (This baseline is informational and non-blocking by design.)"

# Non-blocking: a successful PASSIVE scan exits 0 even if alerts were found.
exit 0
