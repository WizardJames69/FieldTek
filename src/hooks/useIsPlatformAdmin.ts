import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsPlatformAdmin(enabled: boolean) {
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setIsPlatformAdmin(false);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc("is_platform_admin");
      if (error) throw error;
      setIsPlatformAdmin(Boolean(data));
    } catch (e) {
      setIsPlatformAdmin(false);
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { isPlatformAdmin, loading, error, refresh };
}
