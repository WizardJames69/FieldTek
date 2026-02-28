import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize error tracking before app renders
import { initErrorTracking } from "@/lib/errorTracking";
import { initSentry, bridgeSentryToErrorTracking } from "@/lib/sentry";
initErrorTracking();
initSentry();
bridgeSentryToErrorTracking();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
