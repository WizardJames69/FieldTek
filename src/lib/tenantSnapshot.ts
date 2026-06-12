import type { Tenant, TenantUser, TenantSettings, TenantBranding } from '@/types/database';

// ── Offline tenant snapshot ─────────────────────────────────────────────
// Cold-opening the installed PWA offline serves the precached app shell, but
// tenant/role can't be fetched — RoleGuard would render null (blank screen).
// TenantContext persists the last successful tenant load per user so the shell
// can hydrate offline. Keyed by user id so one user's snapshot is never used for
// another; localStorage already holds the Supabase session itself, so this
// stores no new class of data. All access is try/catch (private mode / quota
// safe).
//
// These helpers live in a leaf module (not in TenantContext) so the sign-out
// path in AuthContext can clear snapshots without creating an
// AuthContext <-> TenantContext import cycle.

export const TENANT_SNAPSHOT_KEY_PREFIX = 'fieldtek-tenant-snapshot:';
const TENANT_SNAPSHOT_VERSION = 1;

export interface TenantSnapshot {
  v: number;
  savedAt: string;
  tenantUser: TenantUser;
  tenant: Tenant;
  settings: TenantSettings | null;
  branding: TenantBranding | null;
}

const tenantSnapshotKey = (userId: string) => `${TENANT_SNAPSHOT_KEY_PREFIX}${userId}`;

export function readTenantSnapshot(userId: string): TenantSnapshot | null {
  try {
    const raw = localStorage.getItem(tenantSnapshotKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TenantSnapshot;
    if (parsed?.v !== TENANT_SNAPSHOT_VERSION || !parsed.tenantUser || !parsed.tenant) return null;
    // The snapshot must belong to this user — never hydrate someone else's.
    if (parsed.tenantUser.user_id !== userId) return null;
    return parsed;
  } catch (e) {
    console.error('Error reading tenant snapshot:', e);
    return null;
  }
}

export function writeTenantSnapshot(userId: string, snapshot: Omit<TenantSnapshot, 'v' | 'savedAt'>): void {
  try {
    localStorage.setItem(
      tenantSnapshotKey(userId),
      JSON.stringify({ v: TENANT_SNAPSHOT_VERSION, savedAt: new Date().toISOString(), ...snapshot })
    );
  } catch (e) {
    console.error('Error writing tenant snapshot:', e);
  }
}

export function removeTenantSnapshot(userId: string): void {
  try {
    localStorage.removeItem(tenantSnapshotKey(userId));
  } catch (e) {
    console.error('Error removing tenant snapshot:', e);
  }
}

/**
 * Clear tenant snapshot(s) from localStorage. Used by sign-out so a shared
 * device does not retain the previous user's offline tenant/role.
 *
 * - With a userId: removes only that user's snapshot.
 * - Without a userId (e.g. the session was already cleared): removes every
 *   `fieldtek-tenant-snapshot:` key, leaving all other localStorage untouched.
 *
 * Best-effort and try/catch safe — never throws.
 */
export function clearTenantSnapshot(userId?: string): void {
  try {
    if (userId) {
      localStorage.removeItem(tenantSnapshotKey(userId));
      return;
    }
    // Collect first, then remove — removing while iterating by index shifts keys.
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(TENANT_SNAPSHOT_KEY_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.error('Error clearing tenant snapshot(s):', e);
  }
}
