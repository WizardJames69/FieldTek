import { useState, useEffect, useCallback } from "react";
import { X, Download, Smartphone, Share, Plus, Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform =
  | "ios-safari"
  | "ios-other"
  | "android-chrome"
  | "android-other"
  | "desktop"
  | "installed"
  | "unknown";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unknown";

  // Already installed as PWA
  if (window.matchMedia("(display-mode: standalone)").matches) return "installed";
  if ((window.navigator as any).standalone === true) return "installed";

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);
  const isChrome = /Chrome/.test(ua) || /CriOS/.test(ua);

  if (isIOS && isSafari) return "ios-safari";
  if (isIOS) return "ios-other";
  if (isAndroid && isChrome) return "android-chrome";
  if (isAndroid) return "android-other";
  return "desktop";
}

const MAX_DISMISS_COUNT = 3;
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// iOS Share icon (box with arrow pointing up) — the real iOS share icon
function IOSShareIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.684 8.307L12 5l3.316 3.307" />
      <line x1="12" y1="5" x2="12" y2="15" />
      <path d="M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7" />
    </svg>
  );
}

function AndroidInstallCard({
  onInstall,
  onDismiss,
}: {
  onInstall: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-xl p-4 relative">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
        aria-label="Dismiss install prompt"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
          <img src="/pwa-icon-192.png" alt="FieldTek" className="w-9 h-9 rounded-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
            Add to Home Screen
          </p>
          <h3 className="font-bold text-foreground text-sm leading-tight">FieldTek</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Faster access · Works offline · Push notifications
          </p>
          <Button onClick={onInstall} size="sm" className="mt-3 h-8 text-xs gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Install App
          </Button>
        </div>
      </div>
    </div>
  );
}

function IOSSafariCard({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: <IOSShareIcon className="h-6 w-6 text-primary" />,
      text: (
        <>
          Tap the{" "}
          <IOSShareIcon className="inline h-4 w-4 mx-0.5 text-primary align-middle" />
          <strong> Share</strong> button in the Safari toolbar
        </>
      ),
    },
    {
      icon: <Plus className="h-6 w-6 text-primary" />,
      text: (
        <>
          Scroll down and tap <strong>"Add to Home Screen"</strong>
        </>
      ),
    },
    {
      icon: <Smartphone className="h-6 w-6 text-primary" />,
      text: (
        <>
          Tap <strong>Add</strong> — FieldTek will appear on your home screen
        </>
      ),
    },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl shadow-xl p-4 relative">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
        aria-label="Dismiss install prompt"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="pr-8">
        <div className="flex items-center gap-2 mb-3">
          <img src="/pwa-icon-192.png" alt="FieldTek" className="w-8 h-8 rounded-lg" />
          <div>
            <h3 className="font-bold text-foreground text-sm leading-tight">Install FieldTek</h3>
            <p className="text-xs text-muted-foreground">Add to your Home Screen</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 mb-3">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="flex items-start gap-3"
          >
            <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              {steps[step].icon}
            </div>
            <p className="text-sm text-foreground leading-relaxed pt-1">{steps[step].text}</p>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            disabled={step === 0}
          >
            ← Back
          </button>
          <span className="text-xs text-muted-foreground">
            Step {step + 1} of {steps.length}
          </span>
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={onDismiss}
              className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Done ✓
            </button>
          )}
        </div>
      </div>

      {/* Arrow pointing to Safari toolbar */}
      {step === 0 && (
        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground animate-bounce">
          <span>↓</span>
          <span>Tap the share icon in the bottom toolbar</span>
          <span>↓</span>
        </div>
      )}
    </div>
  );
}

function IOSOtherBrowserCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-xl p-4 relative">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <div className="flex-shrink-0 w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
          <Share className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h3 className="font-bold text-foreground text-sm">Open in Safari to Install</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            iOS only supports app installation from Safari. Open{" "}
            <strong>fieldtek.ai</strong> in Safari to add it to your Home Screen.
          </p>
        </div>
      </div>
    </div>
  );
}

function DesktopInstallCard({
  onInstall,
  onDismiss,
}: {
  onInstall: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-xl p-4 relative">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
          <Chrome className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-foreground text-sm">Install FieldTek</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Install as a desktop app for faster access and offline support
          </p>
          <div className="flex gap-2 mt-3">
            <Button onClick={onInstall} size="sm" className="h-8 text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Install
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              asChild
            >
              <Link to="/install">Learn more</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [platform, setPlatform] = useState<Platform>("unknown");

  useEffect(() => {
    const detected = detectPlatform();
    setPlatform(detected);

    if (detected === "installed") return;

    // Check dismiss history
    const dismissCount = parseInt(localStorage.getItem("pwa-install-dismiss-count") || "0", 10);
    if (dismissCount >= MAX_DISMISS_COUNT) return;

    const lastDismissed = parseInt(localStorage.getItem("pwa-install-dismissed") || "0", 10);
    if (lastDismissed && Date.now() - lastDismissed < DISMISS_COOLDOWN_MS) return;

    if (detected === "ios-safari") {
      const timer = setTimeout(() => setShowBanner(true), 4000);
      return () => clearTimeout(timer);
    }

    if (detected === "ios-other") {
      const timer = setTimeout(() => setShowBanner(true), 5000);
      return () => clearTimeout(timer);
    }

    // Android/Desktop — wait for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 3000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShowBanner(false);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    const count = parseInt(localStorage.getItem("pwa-install-dismiss-count") || "0", 10);
    localStorage.setItem("pwa-install-dismiss-count", String(count + 1));
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  }, []);

  if (!showBanner || platform === "installed" || platform === "unknown") return null;

  return (
    <AnimatePresence>
      <motion.div
        key="install-prompt"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80"
      >
        {platform === "ios-safari" && <IOSSafariCard onDismiss={handleDismiss} />}
        {platform === "ios-other" && <IOSOtherBrowserCard onDismiss={handleDismiss} />}
        {(platform === "android-chrome" || platform === "android-other") && (
          <AndroidInstallCard onInstall={handleInstall} onDismiss={handleDismiss} />
        )}
        {platform === "desktop" && deferredPrompt && (
          <DesktopInstallCard onInstall={handleInstall} onDismiss={handleDismiss} />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
