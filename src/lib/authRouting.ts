import { supabase } from "@/integrations/supabase/client";

/**
 * Wraps a promise with a timeout. Rejects if the promise doesn't resolve within the specified time.
 */
export function withTimeout<T>(
  promiseFn: () => Promise<T>,
  timeoutMs: number,
  errorMessage = "Operation timed out"
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    promiseFn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Check if the current user is a platform admin.
 * Uses a 6-second timeout to prevent indefinite hanging.
 */
export async function checkIsPlatformAdmin(): Promise<{
  isAdmin: boolean;
  error: string | null;
}> {
  try {
    const result = await withTimeout(
      async () => {
        const { data, error } = await supabase.rpc("is_platform_admin");
        return { data, error };
      },
      6000,
      "Platform admin check timed out"
    );

    if (result.error) {
      console.error("Platform admin check error:", result.error);
      return { isAdmin: false, error: result.error.message };
    }

    return { isAdmin: Boolean(result.data), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Platform admin check failed:", message);
    return { isAdmin: false, error: message };
  }
}

/**
 * Check if the current user has a tenant membership.
 * Uses a 6-second timeout to prevent indefinite hanging.
 */
export async function checkHasTenantMembership(): Promise<{
  hasTenant: boolean;
  tenantId: string | null;
  error: string | null;
}> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) {
      return { hasTenant: false, tenantId: null, error: null };
    }

    const userId = session.session.user.id;
    const result = await withTimeout(
      async () => {
        const { data, error } = await supabase
          .from("tenant_users")
          .select("tenant_id")
          .eq("user_id", userId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        return { data, error };
      },
      6000,
      "Tenant membership check timed out"
    );

    if (result.error) {
      console.error("Tenant membership check error:", result.error);
      return { hasTenant: false, tenantId: null, error: result.error.message };
    }

    return {
      hasTenant: !!result.data?.tenant_id,
      tenantId: result.data?.tenant_id || null,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Tenant membership check failed:", message);
    return { hasTenant: false, tenantId: null, error: message };
  }
}

/**
 * Check if the current user is a portal client (has a linked client record).
 */
export async function checkIsPortalClient(): Promise<boolean> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) return false;

    const result = await withTimeout(
      async () => {
        const { data, error } = await supabase
          .from("clients")
          .select("id")
          .eq("user_id", session.session!.user.id)
          .limit(1)
          .maybeSingle();
        return { data, error };
      },
      6000,
      "Portal client check timed out"
    );

    return !!result.data?.id;
  } catch {
    return false;
  }
}

/**
 * Determine the post-login destination for a user.
 * Returns the path to navigate to after successful authentication.
 */
export async function getPostLoginDestination(): Promise<{
  destination: string;
  error: string | null;
}> {
  try {
    // First check if platform admin
    const adminResult = await checkIsPlatformAdmin();
    if (adminResult.isAdmin) {
      return { destination: "/admin", error: null };
    }

    // Then check tenant membership
    const tenantResult = await checkHasTenantMembership();
    if (tenantResult.error) {
      // If there's an error, default to dashboard (it will handle redirects)
      return { destination: "/dashboard", error: tenantResult.error };
    }

    if (tenantResult.hasTenant) {
      // Check if user is a technician - route them to /my-jobs instead of /dashboard
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user?.id) {
          const { data: roleData } = await supabase
            .from("tenant_users")
            .select("role")
            .eq("user_id", session.session.user.id)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

          if (roleData?.role === "technician") {
            return { destination: "/my-jobs", error: null };
          }
        }
      } catch {
        // Fall through to default dashboard
      }
      return { destination: "/dashboard", error: null };
    }

    // Check if user is a portal client before sending to onboarding
    const isPortalClient = await checkIsPortalClient();
    if (isPortalClient) {
      return { destination: "/portal", error: null };
    }

    // No tenant and not a portal client - go to onboarding
    return { destination: "/onboarding", error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { destination: "/dashboard", error: message };
  }
}
