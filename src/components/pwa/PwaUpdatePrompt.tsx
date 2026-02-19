import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";
import { APP_VERSION } from "@/lib/version";

// Force clear all caches and service workers, then reload
async function hardReloadApp() {
  try {
    // Unregister all service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(r => r.unregister()));
    
    // Clear all caches
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map(key => caches.delete(key)));
    
    // Remove the forceUpdate param and reload
    const url = new URL(window.location.href);
    url.searchParams.delete('forceUpdate');
    window.location.replace(url.toString());
  } catch (error) {
    console.error("[PWA] Hard reload failed:", error);
    window.location.reload();
  }
}

export function PwaUpdatePrompt() {
  const hasPromptedRef = useRef(false);
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Log version on mount
    console.log(`[PWA] Running version ${APP_VERSION}`);

    // Check for force update parameter
    const params = new URLSearchParams(window.location.search);
    if (params.get('forceUpdate') === '1') {
      console.log("[PWA] Force update requested via URL parameter");
      hardReloadApp();
      return;
    }

    // Only run SW logic in production
    if (import.meta.env.DEV) return;

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        if (hasPromptedRef.current) return;
        hasPromptedRef.current = true;

        console.log("[PWA] Update available, applying automatically...");
        
        // Show brief updating indicator
        setIsUpdating(true);
        
        // Auto-apply update after short delay
        setTimeout(() => {
          console.log("[PWA] Reloading to apply update...");
          updateSW(true).catch((error) => {
            console.error("[PWA] Auto-update failed:", error);
            setIsUpdating(false);
            
            // Fall back to toast notification
            toast("Update Available", {
              description: "A new version is ready. Refresh to get the latest features.",
              duration: Infinity,
              action: {
                label: "Refresh",
                onClick: () => {
                  updateSW(true);
                },
              },
            });
          });
        }, 1500);
      },
      onOfflineReady() {
        console.log("[PWA] App ready to work offline");
      },
      onRegisterError(error) {
        console.error("[PWA] SW registration error:", error);
      },
    });

    updateSWRef.current = updateSW;

    // Proactively check for updates on visibility change / focus
    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          console.log("[PWA] SW update check triggered");
        }
      } catch (error) {
        console.error("[PWA] SW update check failed:", error);
      }
    };

    // Check for updates when app becomes visible or gains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };

    const handleFocus = () => {
      checkForUpdates();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Also check immediately on mount
    checkForUpdates();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Show updating overlay when auto-update is in progress
  if (isUpdating) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-foreground">Updating...</p>
        </div>
      </div>
    );
  }

  return null;
}
