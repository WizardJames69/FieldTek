import { describe, it, expect } from "vitest";
import { shouldRedirectToAdminConsole } from "@/lib/adminRedirect";

// The tenant /dashboard auto-redirects platform admins to the /admin console
// (they have no tenant membership of their own). Two cases must suppress that:
//
//  1. Active impersonation ("View as") routes the admin to /dashboard on
//     purpose — redirecting would bounce them straight back to /admin.
//  2. Impersonation restoration is still loading. On a full page reload,
//     ImpersonationContext rehydrates from localStorage asynchronously, so
//     isImpersonating is briefly false before restoration completes. Redirecting
//     during that window reintroduces the same bounce on refresh. When the
//     impersonation state is still unknown, we must NOT redirect yet.

describe("shouldRedirectToAdminConsole", () => {
  it("redirects a platform admin who is NOT impersonating and not loading", () => {
    expect(
      shouldRedirectToAdminConsole({ isPlatformAdmin: true, isImpersonating: false, isImpersonationLoading: false }),
    ).toBe(true);
  });

  it("does NOT redirect a platform admin who IS impersonating", () => {
    expect(
      shouldRedirectToAdminConsole({ isPlatformAdmin: true, isImpersonating: true, isImpersonationLoading: false }),
    ).toBe(false);
  });

  it("does NOT redirect while impersonation restoration is still loading (the refresh edge)", () => {
    expect(
      shouldRedirectToAdminConsole({ isPlatformAdmin: true, isImpersonating: false, isImpersonationLoading: true }),
    ).toBe(false);
  });

  it("does NOT redirect a platform admin who is both impersonating and loading", () => {
    expect(
      shouldRedirectToAdminConsole({ isPlatformAdmin: true, isImpersonating: true, isImpersonationLoading: true }),
    ).toBe(false);
  });

  it("does NOT redirect a non-admin tenant user", () => {
    expect(
      shouldRedirectToAdminConsole({ isPlatformAdmin: false, isImpersonating: false, isImpersonationLoading: false }),
    ).toBe(false);
  });

  it("does NOT redirect a non-admin regardless of impersonation/loading flags", () => {
    expect(
      shouldRedirectToAdminConsole({ isPlatformAdmin: false, isImpersonating: true, isImpersonationLoading: true }),
    ).toBe(false);
  });
});
