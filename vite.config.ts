import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // We handle registration manually via virtual:pwa-register
      includeAssets: ["favicon.png", "robots.txt", "pwa-icon-192.png", "pwa-icon-512.png"],
      manifest: {
        name: "FieldTek - Field Service Management",
        short_name: "FieldTek",
        description: "All-in-one field service management software for modern service companies",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/dashboard",
        icons: [
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ],
        screenshots: [
          {
            src: "/social/dashboard-jobs-screenshot.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "FieldTek Dashboard"
          },
          {
            src: "/social/mobile-tech-screenshot.png",
            sizes: "390x844",
            type: "image/png",
            form_factor: "narrow",
            label: "Mobile Technician View"
          },
          {
            src: "/social/schedule-calendar-screenshot.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Job Scheduling Calendar"
          },
          {
            src: "/social/ai-assistant-screenshot.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "AI Field Assistant"
          }
        ]
      },
    workbox: {
      clientsClaim: true,
      skipWaiting: true,
      cleanupOutdatedCaches: true,
      // Serve the precached SPA shell for same-origin navigations so installed
      // PWAs cold-open offline. Applies only to mode:"navigate" requests —
      // cross-origin Supabase fetches are never routed through this fallback.
      navigateFallback: "index.html",
      navigateFallbackDenylist: [/^\/~oauth/, /^\/admin/, /^\/api/],
      // "html" must stay in this list: navigateFallback requires index.html to
      // be in the precache manifest or the generated SW throws on activation.
      globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      // Push/notification/background-sync handlers live in public/sw-push.js and
      // are pulled into the single Workbox-generated sw.js (one SW owns scope /).
      importScripts: ["sw-push.js"],
        // NOTE: Supabase API responses (/rest/v1, /auth/v1, /functions/v1,
        // and signed/private storage URLs) are deliberately NOT cached by the
        // service worker. Workbox cache keys ignore the Authorization header,
        // so a shared device could serve one user's cached tenant data to the
        // next. Offline behavior for technicians is handled by the explicit
        // IndexedDB/offline-sync layer, not by caching authenticated requests.
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "font-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      }
    }),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: `fieldtek@${process.env.VITE_APP_VERSION || "dev"}` },
      sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'framer-motion': ['framer-motion'],
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-tooltip'],
        },
      },
    },
    cssCodeSplit: true,
    minify: 'esbuild',
    target: 'esnext',
    modulePreload: { polyfill: false },
  },
  };
});
