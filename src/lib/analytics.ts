// Analytics utility for tracking events

type EventParams = Record<string, string | number | boolean>;

// Track a custom event
export function trackEvent(eventName: string, params?: EventParams): void {
  // GA4 tracking
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", eventName, params);
  }

  // Console log in development
  if (import.meta.env.DEV) {
    console.log("[Analytics]", eventName, params);
  }
}

// Track page views
export function trackPageView(path: string, title?: string): void {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "page_view", {
      page_path: path,
      page_title: title || document.title,
    });
  }
}

// Extract UTM parameters from URL
export function getUtmParams(): {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
} {
  if (typeof window === "undefined") {
    return { utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_content: params.get("utm_content"),
  };
}

// Store UTM params in session for later use
export function storeUtmParams(): void {
  const utmParams = getUtmParams();
  const hasAnyUtm = Object.values(utmParams).some(v => v !== null);

  if (hasAnyUtm) {
    sessionStorage.setItem("utm_params", JSON.stringify(utmParams));
  }
}

// Retrieve stored UTM params
export function getStoredUtmParams(): ReturnType<typeof getUtmParams> {
  try {
    const stored = sessionStorage.getItem("utm_params");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }

  // Fall back to current URL params
  return getUtmParams();
}

// Initialize analytics (call on app load)
export function initAnalytics(): void {
  // Store UTM params on initial load
  storeUtmParams();
}
