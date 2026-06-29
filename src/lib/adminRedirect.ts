/**
 * Pure decision for whether the tenant /dashboard should bounce the current
 * user to the /admin console.
 *
 * Platform admins have no tenant membership, so landing on /dashboard normally
 * redirects them to /admin. Two cases suppress that redirect:
 *   - Active impersonation ("View as"): the admin is sent to /dashboard
 *     deliberately to view a tenant — redirecting bounces them back to /admin.
 *   - Impersonation restoration still loading: on a full reload the
 *     impersonation state rehydrates from localStorage asynchronously, so
 *     isImpersonating is briefly false. Redirecting before it settles would
 *     reintroduce the bounce on refresh, so we wait until the state is known.
 */
export function shouldRedirectToAdminConsole(params: {
  isPlatformAdmin: boolean;
  isImpersonating: boolean;
  isImpersonationLoading: boolean;
}): boolean {
  return params.isPlatformAdmin && !params.isImpersonating && !params.isImpersonationLoading;
}
