import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X, Settings, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

const defaultPreferences: CookiePreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
};

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
    };
    localStorage.setItem("cookie-consent", JSON.stringify(allAccepted));
    // Trigger GA4 initialization
    initializeGA4();
    setIsVisible(false);
  };

  const initializeGA4 = () => {
    // Guard against double initialization - check if script already loaded
    if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
      return;
    }
    
    // Load GA4 script if analytics consented
    try {
      const consent = localStorage.getItem('cookie-consent');
      if (consent) {
        const prefs = JSON.parse(consent);
        if (prefs.analytics === true) {
          const script = document.createElement('script');
          script.async = true;
          script.src = 'https://www.googletagmanager.com/gtag/js?id=G-REGV1LE08E';
          document.head.appendChild(script);
          
          (window as any).dataLayer = (window as any).dataLayer || [];
          function gtag(...args: any[]) {
            (window as any).dataLayer.push(args);
          }
          (window as any).gtag = gtag;
          gtag('js', new Date());
          gtag('config', 'G-REGV1LE08E', { send_page_view: true });
        }
      }
    } catch (e) {
      console.warn('GA4 init error:', e);
    }
  };

  const handleRejectAll = () => {
    localStorage.setItem("cookie-consent", JSON.stringify(defaultPreferences));
    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem("cookie-consent", JSON.stringify(preferences));
    // Trigger GA4 initialization if analytics was enabled
    if (preferences.analytics) {
      initializeGA4();
    }
    setIsVisible(false);
  };

  const togglePreference = (key: keyof CookiePreferences) => {
    if (key === "necessary") return;
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const cookieTypes = [
    {
      key: "necessary" as const,
      label: "Necessary",
      description: "Essential for the website to function properly",
      locked: true,
    },
    {
      key: "analytics" as const,
      label: "Analytics",
      description: "Help us understand how visitors interact with our site",
      locked: false,
    },
    {
      key: "marketing" as const,
      label: "Marketing",
      description: "Used to deliver personalized advertisements",
      locked: false,
    },
    {
      key: "preferences" as const,
      label: "Preferences",
      description: "Remember your settings and preferences",
      locked: false,
    },
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
        >
          <motion.div
            layout
            className="mx-auto max-w-4xl rounded-2xl border border-border bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <Cookie className="h-6 w-6 text-primary" />
                </motion.div>
                <h3 className="text-lg font-semibold text-foreground">Cookie Preferences</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRejectAll}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-4 md:p-6">
              <AnimatePresence mode="wait">
                {!showSettings ? (
                  <motion.div
                    key="simple"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="text-muted-foreground text-sm md:text-base mb-6">
                      We use cookies to enhance your browsing experience, serve personalized 
                      content, and analyze our traffic. By clicking "Accept All", you consent 
                      to our use of cookies.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={handleAcceptAll}
                        className="flex-1 gap-2"
                        data-testid="cookie-accept-all"
                      >
                        <Check className="h-4 w-4" />
                        Accept All
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleRejectAll}
                        className="flex-1"
                        data-testid="cookie-reject-all"
                      >
                        Reject All
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setShowSettings(true)}
                        className="flex-1 gap-2"
                        data-testid="cookie-customize"
                      >
                        <Settings className="h-4 w-4" />
                        Customize
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="space-y-4 mb-6">
                      {cookieTypes.map((cookie, index) => (
                        <motion.div
                          key={cookie.key}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex-1">
                            <Label
                              htmlFor={cookie.key}
                              className="text-sm font-medium text-foreground cursor-pointer"
                            >
                              {cookie.label}
                              {cookie.locked && (
                                <span className="ml-2 text-xs text-muted-foreground">(Required)</span>
                              )}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              {cookie.description}
                            </p>
                          </div>
                          <Switch
                            id={cookie.key}
                            checked={preferences[cookie.key]}
                            onCheckedChange={() => togglePreference(cookie.key)}
                            disabled={cookie.locked}
                          />
                        </motion.div>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={handleSavePreferences}
                        className="flex-1 gap-2"
                      >
                        <Check className="h-4 w-4" />
                        Save Preferences
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setShowSettings(false)}
                        className="flex-1"
                      >
                        Back
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
