import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Handles push notification deeplinks in two scenarios:
 * 1. App already open: Service worker posts NOTIFICATION_CLICK message → navigate in-app
 * 2. App launched from notification: URL contains ?notification=1 → navigate to target
 */
export function useNotificationDeeplink() {
  const navigate = useNavigate();

  // Scenario 1: App is open, SW posts a message
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (!event.data) return;

      if (event.data.type === "NOTIFICATION_CLICK") {
        const { url } = event.data as { url?: string };
        if (url) {
          // Strip origin to get just the path
          try {
            const path = new URL(url, window.location.origin).pathname +
              new URL(url, window.location.origin).search;
            navigate(path, { replace: false });
          } catch {
            // Fallback: use the url directly if it's already a path
            if (url.startsWith("/")) {
              navigate(url, { replace: false });
            }
          }
        }
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [navigate]);

  // Scenario 2: App launched from notification (new window opened by SW)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isFromNotification = params.get("notification") === "1";

    if (!isFromNotification) return;

    // Remove the notification param from the URL without triggering a reload
    const cleanUrl = window.location.pathname + 
      window.location.search.replace(/[?&]notification=1/, "").replace(/^&/, "?");
    window.history.replaceState({}, "", cleanUrl || window.location.pathname);
  }, []);
}
