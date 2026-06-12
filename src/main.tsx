import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Initialize error tracking before app renders
import { initErrorTracking } from "@/lib/errorTracking";
import { initSentry, bridgeSentryToErrorTracking } from "@/lib/sentry";
initErrorTracking();
initSentry();
bridgeSentryToErrorTracking();

// After a deploy, an already-open tab can hold HTML referencing hashed lazy
// chunks that no longer exist on the server. Reload to pick up the new build.
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

// Register the Workbox service worker (precached app shell + offline cold-open).
// No-op in dev; supabase API/auth/storage responses are never cached (see vite.config.ts).
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
