// App version for debugging PWA cache issues
// Update this when making significant changes to force cache invalidation
export const APP_VERSION = "2026.01.30.1";

// Build timestamp - useful for verifying which build is running
export const BUILD_TIME = new Date().toISOString();

// Log version info on import
if (typeof window !== 'undefined') {
  console.log(`[FieldTek] Version ${APP_VERSION} | Built: ${BUILD_TIME}`);
}
