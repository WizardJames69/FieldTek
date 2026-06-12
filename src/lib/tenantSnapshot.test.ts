import { describe, it, expect, beforeEach } from 'vitest';
import { clearTenantSnapshot, TENANT_SNAPSHOT_KEY_PREFIX } from './tenantSnapshot';

const snapKey = (userId: string) => `${TENANT_SNAPSHOT_KEY_PREFIX}${userId}`;

// The global test setup (src/test/setup.ts) stubs localStorage with inert
// vi.fn()s. Back it with a real in-memory store for these tests so we exercise
// actual read/write/key-iteration behavior. Scoped to this file (vitest isolates
// modules per file), so it does not affect other specs.
function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const ls = window.localStorage as unknown as Record<string, unknown>;
  ls.getItem = (k: string) => (store.has(k) ? store.get(k)! : null);
  ls.setItem = (k: string, v: string) => { store.set(k, String(v)); };
  ls.removeItem = (k: string) => { store.delete(k); };
  ls.clear = () => { store.clear(); };
  ls.key = (i: number) => Array.from(store.keys())[i] ?? null;
  Object.defineProperty(ls, 'length', { get: () => store.size, configurable: true });
}

describe('clearTenantSnapshot', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    localStorage.clear();
  });

  it('removes only the given user\'s snapshot, leaving other users and non-FieldTek keys', () => {
    localStorage.setItem(snapKey('user-a'), JSON.stringify({ v: 1 }));
    localStorage.setItem(snapKey('user-b'), JSON.stringify({ v: 1 }));
    localStorage.setItem('sb-access-token', 'session-token'); // Supabase session — must survive
    localStorage.setItem('theme', 'dark'); // unrelated app pref — must survive

    clearTenantSnapshot('user-a');

    expect(localStorage.getItem(snapKey('user-a'))).toBeNull();
    expect(localStorage.getItem(snapKey('user-b'))).not.toBeNull();
    expect(localStorage.getItem('sb-access-token')).toBe('session-token');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('without a userId removes every FieldTek snapshot key but nothing else', () => {
    localStorage.setItem(snapKey('user-a'), JSON.stringify({ v: 1 }));
    localStorage.setItem(snapKey('user-b'), JSON.stringify({ v: 1 }));
    localStorage.setItem(snapKey('user-c'), JSON.stringify({ v: 1 }));
    localStorage.setItem('sb-access-token', 'session-token');
    localStorage.setItem('theme', 'dark');

    clearTenantSnapshot();

    expect(localStorage.getItem(snapKey('user-a'))).toBeNull();
    expect(localStorage.getItem(snapKey('user-b'))).toBeNull();
    expect(localStorage.getItem(snapKey('user-c'))).toBeNull();
    expect(localStorage.getItem('sb-access-token')).toBe('session-token');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('is a no-op (no throw) when there are no snapshots to clear', () => {
    localStorage.setItem('theme', 'dark');
    expect(() => clearTenantSnapshot('missing-user')).not.toThrow();
    expect(() => clearTenantSnapshot()).not.toThrow();
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
