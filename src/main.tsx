import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Initialize error tracking before app renders
import { initErrorTracking } from "@/lib/errorTracking";
import { initSentry, bridgeSentryToErrorTracking } from "@/lib/sentry";
import { showUpdatePrompt, logBuildInfo } from "@/lib/pwaUpdate";
initErrorTracking();
initSentry();
bridgeSentryToErrorTracking();
logBuildInfo();

// After a deploy, an already-open tab can hold HTML referencing hashed lazy
// chunks that no longer exist on the server. Reload to pick up the new build.
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

// Register the Workbox service worker (precached app shell + offline cold-open).
// "prompt" mode (vite.config.ts): when a new build is ready we surface a toast
// and let the user reload, instead of auto-reloading silently. No-op in dev;
// Supabase API/auth/storage responses are never cached (see vite.config.ts).
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    showUpdatePrompt(updateSW);
  },
  onRegisterError(error) {
    console.error("[FieldTek] service worker registration failed", error);
  },
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
