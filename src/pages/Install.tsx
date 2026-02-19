import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Smartphone,
  Download,
  Check,
  Share,
  Plus,
  Bell,
  Wifi,
  Zap,
  ArrowRight,
  Chrome,
  X,
} from "lucide-react";

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

const benefits = [
  { icon: Zap, text: "Instant launch from home screen" },
  { icon: Wifi, text: "Works offline in the field" },
  { icon: Bell, text: "Push notifications for job updates" },
  { icon: Smartphone, text: "Native app-like experience" },
];

function StepCard({
  number,
  icon,
  title,
  description,
  active,
  done,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  active: boolean;
  done: boolean;
}) {
  return (
    <motion.div
      animate={{
        opacity: active || done ? 1 : 0.5,
        scale: active ? 1 : 0.98,
      }}
      transition={{ duration: 0.2 }}
      className={`relative flex gap-4 p-4 rounded-2xl border transition-colors ${
        active
          ? "border-primary/30 bg-primary/5"
          : done
          ? "border-border bg-muted/30"
          : "border-border bg-card/50"
      }`}
    >
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
          done
            ? "bg-primary text-primary-foreground"
            : active
            ? "bg-primary/20 text-primary"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? <Check className="h-5 w-5" /> : number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-muted-foreground">{icon}</span>
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

function IOSSafariGuide() {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: <IOSShareIcon className="h-4 w-4" />,
      title: "Tap the Share button",
      description: (
        <>
          Find the{" "}
          <IOSShareIcon className="inline h-3.5 w-3.5 mx-0.5 align-middle" />
          <strong> Share</strong> button in Safari's bottom toolbar (the box with an arrow pointing
          up)
        </>
      ),
    },
    {
      icon: <Plus className="h-4 w-4" />,
      title: 'Tap "Add to Home Screen"',
      description: (
        <>
          Scroll down in the share sheet and tap{" "}
          <strong>"Add to Home Screen"</strong>. You may need to scroll to find it.
        </>
      ),
    },
    {
      icon: <Check className="h-4 w-4" />,
      title: "Tap Add to confirm",
      description: (
        <>
          Review the app name (you can rename it), then tap <strong>Add</strong> in the top-right
          corner. FieldTek will appear on your home screen instantly.
        </>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} onClick={() => setCurrentStep(i)} className="cursor-pointer">
          <StepCard
            number={i + 1}
            icon={step.icon}
            title={step.title}
            description={step.description}
            active={currentStep === i}
            done={currentStep > i}
          />
        </div>
      ))}
      <div className="flex justify-between pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
        >
          ← Back
        </Button>
        {currentStep < steps.length - 1 ? (
          <Button size="sm" onClick={() => setCurrentStep((s) => s + 1)}>
            Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <Check className="h-3.5 w-3.5 mr-1.5" /> All done!
          </Button>
        )}
      </div>

      {/* Visual indicator for toolbar */}
      {currentStep === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center"
        >
          <div className="text-3xl mb-2">↓</div>
          <p className="text-xs text-muted-foreground">
            The Share button is in Safari's bottom toolbar
          </p>
          <div className="mt-3 mx-auto w-fit bg-card border border-border rounded-full px-4 py-2 flex items-center gap-3">
            <span className="text-muted-foreground text-xs">← Back</span>
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
              <IOSShareIcon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-muted-foreground text-xs">⊡</span>
            <span className="text-muted-foreground text-xs">Tabs</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function AndroidChromeGuide({
  deferredPrompt,
}: {
  deferredPrompt: BeforeInstallPromptEvent | null;
}) {
  const [installed, setInstalled] = useState(false);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
  };

  if (installed) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-8"
      >
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Installed!</h3>
        <p className="text-muted-foreground text-sm">
          FieldTek is now on your home screen. Look for it in your app drawer or home screen.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/dashboard">Open FieldTek</Link>
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {deferredPrompt ? (
        <div className="text-center py-4">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <img src="/pwa-icon-192.png" alt="FieldTek" className="w-14 h-14 rounded-2xl" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Ready to Install</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Tap the button below to install FieldTek on your device.
          </p>
          <Button size="lg" onClick={handleInstall} className="gap-2">
            <Download className="h-5 w-5" />
            Install FieldTek
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <StepCard
            number={1}
            icon={<Chrome className="h-4 w-4" />}
            title="Open Chrome menu"
            description='Tap the three-dot menu (⋮) in the top-right corner of Chrome'
            active={true}
            done={false}
          />
          <StepCard
            number={2}
            icon={<Plus className="h-4 w-4" />}
            title='Tap "Add to Home Screen"'
            description='Look for "Add to Home Screen" or "Install App" in the menu options'
            active={false}
            done={false}
          />
          <StepCard
            number={3}
            icon={<Check className="h-4 w-4" />}
            title="Confirm installation"
            description='Tap "Add" or "Install" in the confirmation dialog'
            active={false}
            done={false}
          />
        </div>
      )}
    </div>
  );
}

function DesktopGuide({ deferredPrompt }: { deferredPrompt: BeforeInstallPromptEvent | null }) {
  const [installed, setInstalled] = useState(false);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
  };

  if (installed) {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Installed!</h3>
        <p className="text-muted-foreground text-sm">FieldTek has been installed on your device.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deferredPrompt ? (
        <div className="text-center py-4">
          <Button size="lg" onClick={handleInstall} className="gap-2">
            <Download className="h-5 w-5" />
            Install FieldTek
          </Button>
        </div>
      ) : (
        <div className="rounded-xl bg-muted/50 border border-border p-4 text-sm text-muted-foreground">
          <p>
            To install FieldTek on desktop, look for the install icon (
            <Download className="inline h-3.5 w-3.5 mx-0.5 align-middle" />) in your browser's
            address bar, or open the browser menu and select "Install FieldTek".
          </p>
          <p className="mt-2">
            Supported browsers: Chrome, Edge, Brave, Opera.{" "}
            <strong>Firefox and Safari desktop</strong> do not support PWA install.
          </p>
        </div>
      )}
    </div>
  );
}

function AlreadyInstalledScreen() {
  return (
    <div className="text-center py-12">
      <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <Check className="h-12 w-12 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-3">Already Installed</h2>
      <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
        FieldTek is already running as an installed app. You're all set!
      </p>
      <Button asChild>
        <Link to="/dashboard">
          Open Dashboard <ArrowRight className="h-4 w-4 ml-2" />
        </Link>
      </Button>
    </div>
  );
}

export default function Install() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const detected = detectPlatform();
    setPlatform(detected);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const platformLabel: Record<Platform, string> = {
    "ios-safari": "iPhone / iPad (Safari)",
    "ios-other": "iPhone / iPad",
    "android-chrome": "Android (Chrome)",
    "android-other": "Android",
    desktop: "Desktop",
    installed: "Installed",
    unknown: "Your Device",
  };

  const renderGuide = () => {
    switch (platform) {
      case "installed":
        return <AlreadyInstalledScreen />;
      case "ios-safari":
        return <IOSSafariGuide />;
      case "ios-other":
        return (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm">
            <p className="font-semibold text-foreground mb-1">Open in Safari to Install</p>
            <p className="text-muted-foreground">
              iOS only allows PWA installation from Safari. Open{" "}
              <strong>fieldtek.ai/install</strong> in Safari to continue.
            </p>
          </div>
        );
      case "android-chrome":
        return <AndroidChromeGuide deferredPrompt={deferredPrompt} />;
      case "android-other":
        return (
          <div className="rounded-xl bg-muted/50 border border-border p-4 text-sm text-muted-foreground">
            For the best install experience on Android, open this page in{" "}
            <strong>Google Chrome</strong>.
          </div>
        );
      default:
        return <DesktopGuide deferredPrompt={deferredPrompt} />;
    }
  };

  return (
    <>
      <Helmet>
        <title>Install FieldTek | Add to Home Screen</title>
        <meta name="description" content="Install FieldTek on your device for faster access, offline support, and push notifications." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <img src="/pwa-icon-192.png" alt="FieldTek" className="h-8 w-8 rounded-xl" />
            <span className="font-bold text-foreground text-sm">FieldTek</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <X className="h-4 w-4 mr-1.5" />
              Skip
            </Link>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 py-8">
            {platform !== "installed" && (
              <>
                {/* Hero */}
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <img src="/pwa-icon-192.png" alt="FieldTek" className="w-16 h-16 rounded-2xl" />
                  </div>
                  <h1 className="text-2xl font-bold text-foreground mb-2">
                    Install FieldTek
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    {platformLabel[platform]} · Free · No app store required
                  </p>
                </div>

                {/* Benefits */}
                <div className="grid grid-cols-2 gap-2 mb-8">
                  {benefits.map(({ icon: Icon, text }) => (
                    <div
                      key={text}
                      className="flex items-center gap-2 bg-card border border-border rounded-xl p-3"
                    >
                      <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-xs text-foreground leading-tight">{text}</span>
                    </div>
                  ))}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    How to install
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </>
            )}

            {/* Platform Guide */}
            <AnimatePresence mode="wait">
              <motion.div
                key={platform}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                {renderGuide()}
              </motion.div>
            </AnimatePresence>

            {/* After install: push notifications */}
            {platform !== "installed" && (
              <div className="mt-8 p-4 bg-card border border-border rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Bell className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm mb-1">
                      Enable Push Notifications
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      After installing, open the app and go to{" "}
                      <strong>Settings → Notifications</strong> to enable job assignment alerts,
                      status updates, and reminders.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
