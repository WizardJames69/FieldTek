import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bell, 
  Calendar, 
  Smartphone, 
  MessageSquare, 
  CheckCircle2,
  MapPin,
  Clock,
  User,
  Wrench,
  FileText,
  Send,
  Sparkles,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const scenes = [
  {
    id: 1,
    title: "Service Request Arrives",
    description: "Customer submits a service request through your branded portal",
    points: ["Instant notification to your team", "AI analyzes urgency automatically", "Customer details captured"],
    label: "Request",
  },
  {
    id: 2,
    title: "Smart Scheduling",
    description: "Drag and drop to assign the perfect technician",
    points: ["See real-time availability", "Optimize routes automatically", "Balance workloads efficiently"],
    label: "Schedule",
  },
  {
    id: 3,
    title: "Technician Goes Mobile",
    description: "Your tech gets everything they need on their phone",
    points: ["One-tap navigation to site", "Complete job history access", "Digital checklists & forms"],
    label: "Mobile",
  },
  {
    id: 4,
    title: "AI Assistant On-Site",
    description: "Get instant answers while working",
    points: ["Equipment manuals at fingertips", "Troubleshooting guidance", "Parts recommendations"],
    label: "AI Help",
  },
  {
    id: 5,
    title: "Job Complete & Invoiced",
    description: "Close the job and get paid faster",
    points: ["Auto-generate invoice", "Customer signature capture", "Payment sent instantly"],
    label: "Invoice",
  },
];

// Hook for typewriter effect
function useTypewriter(text: string, speed: number = 20, startTyping: boolean = false) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!startTyping) {
      setDisplayedText("");
      setIsComplete(false);
      return;
    }

    let index = 0;
    setDisplayedText("");
    setIsComplete(false);

    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsComplete(true);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed, startTyping]);

  return { displayedText, isComplete };
}

// Hook for reduced motion preference
function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return prefersReducedMotion;
}

interface SceneProps {
  reducedMotion: boolean;
  isMobile?: boolean;
}

// Service Request Scene - Premium Glass Container
function ServiceRequestScene({ reducedMotion, isMobile }: SceneProps) {
  const animationDelay = isMobile ? 0.1 : 0.3;
  
  return (
    <div className="relative w-full max-w-sm sm:max-w-md mx-auto">
      {/* Glass Container Browser Frame */}
      <div className="bg-background/80 backdrop-blur-xl rounded-xl border border-border/50 shadow-2xl overflow-hidden">
        <div className="bg-muted/30 backdrop-blur-sm px-4 py-2 flex items-center gap-2 border-b border-border/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-background/60 rounded px-3 py-1 text-xs text-muted-foreground text-center border border-border/50">
            portal.yourcompany.com
          </div>
        </div>
        <div className="p-6 space-y-4 bg-gradient-to-b from-background to-background/80">
          {/* Notification Card with glass effect */}
          <motion.div
            initial={reducedMotion || isMobile ? false : { x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: animationDelay, type: "spring", stiffness: 100 }}
            className="bg-primary/10 backdrop-blur-sm border border-primary/20 rounded-lg p-3 sm:p-4"
            style={{ boxShadow: '0 0 20px hsl(var(--primary) / 0.1)' }}
          >
            <div className="flex items-start gap-3">
              <motion.div
                animate={reducedMotion || isMobile ? {} : { scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="p-1.5 sm:p-2 bg-primary rounded-full relative"
                style={{ boxShadow: '0 0 15px hsl(var(--primary) / 0.3)' }}
              >
                <Bell className="w-3 h-3 sm:w-4 sm:h-4 text-primary-foreground" />
                {/* Animated pulse ring */}
                <span className="absolute inset-0 rounded-full bg-primary/50 animate-ping" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">New Service Request</p>
                <p className="text-xs text-muted-foreground mt-1">Emergency AC Repair</p>
              </div>
              <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full font-medium shadow-[0_0_8px_hsl(var(--destructive)/0.3)]">
                Urgent
              </span>
            </div>
          </motion.div>

          {/* Request Details with list-item-native styling */}
          <motion.div
            initial={reducedMotion ? false : { y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="space-y-3"
          >
            {[
              { icon: User, text: "Johnson Residence" },
              { icon: MapPin, text: "1234 Oak Street, Austin TX" },
              { icon: Clock, text: "ASAP - System not cooling" }
            ].map((item, i) => (
              <div 
                key={i} 
                className="list-item-native flex items-center gap-2 text-sm bg-background/60 rounded-lg px-3 py-2 border border-border/50"
              >
                <div 
                  className="h-6 w-6 rounded-md bg-muted flex items-center justify-center"
                >
                  <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <span>{item.text}</span>
              </div>
            ))}
          </motion.div>

          {/* AI Badge with glow */}
          <motion.div
            initial={reducedMotion ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1, type: "spring" }}
            className="flex items-center gap-2 text-xs bg-accent/50 backdrop-blur-sm rounded-full px-3 py-1.5 w-fit border border-accent/50"
            style={{ boxShadow: '0 0 12px hsl(var(--primary) / 0.15)' }}
          >
            <Sparkles className="w-3 h-3 text-primary" />
            <span>AI classified as High Priority</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// Scheduling Scene - Glass Calendar Container
function SchedulingScene({ reducedMotion, isMobile }: SceneProps) {
  return (
    <div className="relative w-full max-w-sm sm:max-w-md mx-auto">
      <div className="bg-background/80 backdrop-blur-xl rounded-xl border border-border/50 shadow-2xl overflow-hidden">
        <div className="bg-muted/30 backdrop-blur-sm px-4 py-3 border-b border-border/50 flex items-center gap-2">
          <div 
            className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center"
            style={{ boxShadow: '0 0 10px hsl(var(--primary) / 0.2)' }}
          >
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <span className="font-medium text-sm">Schedule - Today</span>
        </div>
        <div className="p-4 bg-gradient-to-b from-background to-background/80">
          {/* Time Grid with list-item-native styling */}
          <div className="space-y-2">
            {["9:00 AM", "11:00 AM", "1:00 PM", "3:00 PM"].map((time, i) => (
              <div key={time} className="flex gap-3">
                <span className="text-xs text-muted-foreground w-16 pt-1">{time}</span>
                <div className="flex-1 h-12 relative">
                  {i === 0 && (
                    <div className="list-item-native absolute inset-0 bg-blue-100/80 dark:bg-blue-900/30 backdrop-blur-sm rounded border border-blue-200 dark:border-blue-800 px-2 py-1">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Routine Maintenance</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">Mike S.</p>
                    </div>
                  )}
                  {i === 2 && (
                    <div className="list-item-native absolute inset-0 bg-green-100/80 dark:bg-green-900/30 backdrop-blur-sm rounded border border-green-200 dark:border-green-800 px-2 py-1">
                      <p className="text-xs font-medium text-green-700 dark:text-green-300">Installation</p>
                      <p className="text-xs text-green-600 dark:text-green-400">Sarah K.</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Drop-zone indicator with animated border glow */}
          <motion.div
            initial={reducedMotion ? false : { x: -50, y: 50, opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8, type: "spring" }}
            className="mt-4"
          >
            <motion.div
              animate={reducedMotion ? {} : { 
                boxShadow: [
                  "0 0 0 0 hsl(var(--destructive) / 0)",
                  "0 0 20px 4px hsl(var(--destructive) / 0.3)",
                  "0 0 0 0 hsl(var(--destructive) / 0)"
                ]
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="bg-destructive/10 backdrop-blur-sm border-2 border-dashed border-destructive rounded-lg p-3"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <div>
                  <p className="text-xs font-semibold text-destructive">Emergency AC Repair</p>
                  <p className="text-xs text-muted-foreground">Johnson - Assigning to Mike S.</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Success State */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="flex items-center gap-2 mt-3 text-xs text-green-600 dark:text-green-400"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Job assigned! Tech notified.</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// Mobile Scene - Premium Phone Frame with Inner Glow Edge
function MobileScene({ reducedMotion, isMobile }: SceneProps) {
  return (
    <div className="relative w-full max-w-[200px] sm:max-w-[240px] mx-auto">
      {/* Phone Frame with premium styling */}
      <div 
        className="bg-foreground rounded-[2rem] border-4 border-foreground/20 shadow-2xl overflow-hidden relative"
        style={{ boxShadow: '0 0 40px hsl(var(--foreground) / 0.15), inset 0 0 20px hsl(var(--foreground) / 0.1)' }}
      >
        {/* Inner glow edge */}
        <div className="absolute inset-1 rounded-[1.7rem] border border-white/10 pointer-events-none z-10" />
        
        {/* Notch */}
        <div className="bg-foreground/20 h-6 flex items-center justify-center">
          <div className="w-16 h-4 bg-foreground/30 rounded-full" />
        </div>
        
        <div className="p-4 space-y-3 min-h-[340px] bg-background/95 backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center"
                style={{ boxShadow: '0 0 12px hsl(var(--primary) / 0.3)' }}
              >
                <Wrench className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold">FieldTek</p>
                <p className="text-[10px] text-muted-foreground">2 jobs today</p>
              </div>
            </div>
          </div>

          {/* Notification */}
          <motion.div
            initial={reducedMotion ? false : { y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="bg-primary text-primary-foreground rounded-lg p-2.5"
            style={{ boxShadow: '0 0 15px hsl(var(--primary) / 0.3)' }}
          >
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5" />
              <p className="text-[11px] font-medium">New Job Assigned!</p>
            </div>
          </motion.div>

          {/* Job Card with urgent glow */}
          <motion.div
            initial={reducedMotion ? false : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="priority-glow-urgent bg-background/60 backdrop-blur-sm rounded-lg p-3 border border-border/50"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-xs font-semibold">Emergency AC Repair</p>
                <p className="text-[10px] text-muted-foreground">Johnson Residence</p>
              </div>
              <span className="text-[8px] bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded shadow-[0_0_8px_hsl(var(--destructive)/0.4)]">
                URGENT
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
              <MapPin className="w-3 h-3" />
              <span>1234 Oak Street</span>
            </div>
            
            {/* Navigate Button with shimmer effect */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-primary text-primary-foreground text-xs py-2 rounded-md font-medium flex items-center justify-center gap-1 btn-shimmer"
              style={{ boxShadow: 'inset 0 0 15px hsl(var(--primary) / 0.2)' }}
            >
              <MapPin className="w-3 h-3" />
              Navigate
            </motion.button>
          </motion.div>

          {/* Progress/Status Indicator with gradient fill */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="space-y-1.5"
          >
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground font-medium">Job Progress</span>
              <span className="text-primary font-semibold">25%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: "25%" }}
                transition={{ delay: 1.2, duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        </div>

        {/* Home Indicator */}
        <div className="h-5 flex items-center justify-center bg-background">
          <div className="w-20 h-1 bg-foreground/20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// AI Assistant Scene - Gradient Header with Glass Effect
function AIAssistantScene({ reducedMotion, isMobile }: SceneProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  
  const aiResponseText = "E4 indicates a coil temperature sensor issue. Check:\n\n1. Inspect sensor wiring\n2. Clean evaporator coils\n3. Test sensor resistance (should be 10kΩ at 77°F)";
  
  const { displayedText, isComplete } = useTypewriter(
    aiResponseText, 
    reducedMotion || isMobile ? 5 : 15, 
    messageIndex >= 2
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (messageIndex < 2) {
        setMessageIndex(prev => prev + 1);
      }
    }, messageIndex === 0 ? 500 : 1000);
    return () => clearTimeout(timer);
  }, [messageIndex]);

  return (
    <div className="relative w-full max-w-sm sm:max-w-md mx-auto">
      <div className="bg-background/80 backdrop-blur-xl rounded-xl border border-border/50 shadow-2xl overflow-hidden">
        {/* Gradient header with glass effect */}
        <div className="bg-gradient-to-r from-primary/20 via-accent/10 to-primary/10 backdrop-blur-sm px-4 py-3 border-b border-border/50 flex items-center gap-2">
          <div 
            className="p-1.5 bg-primary rounded-lg"
            style={{ boxShadow: '0 0 15px hsl(var(--primary) / 0.3)' }}
          >
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-medium text-sm">AI Field Assistant</span>
            <p className="text-xs text-muted-foreground">Powered by equipment manuals</p>
          </div>
        </div>
        
        <div className="p-4 min-h-[220px] space-y-3 bg-gradient-to-b from-background to-background/80">
          {/* User Message with subtle shadow */}
          <AnimatePresence>
            {messageIndex >= 1 && (
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-end"
              >
                <div 
                  className="max-w-[85%] rounded-lg p-3 bg-primary text-primary-foreground"
                  style={{ boxShadow: '0 4px 12px hsl(var(--primary) / 0.2)' }}
                >
                  <p className="text-xs">Carrier AC unit showing E4 error code</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* AI Response with typewriter and glass styling */}
          <AnimatePresence>
            {messageIndex >= 2 && (
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div 
                  className="max-w-[85%] rounded-lg p-3 bg-muted/80 backdrop-blur-sm border border-border/50"
                  style={{ boxShadow: '0 4px 12px hsl(var(--foreground) / 0.05)' }}
                >
                  <p className="text-xs whitespace-pre-line">
                    {displayedText}
                    {!isComplete && (
                      <span className="inline-block w-0.5 h-3 bg-foreground ml-0.5 animate-pulse" />
                    )}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Modern typing indicator with pulse animation */}
          {messageIndex === 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-1.5 px-3 py-2 bg-muted/50 rounded-full w-fit"
            >
              <motion.div 
                animate={reducedMotion ? {} : { scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }} 
                transition={{ repeat: Infinity, duration: 0.8 }} 
                className="w-2 h-2 bg-primary rounded-full" 
              />
              <motion.div 
                animate={reducedMotion ? {} : { scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }} 
                transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} 
                className="w-2 h-2 bg-primary rounded-full" 
              />
              <motion.div 
                animate={reducedMotion ? {} : { scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }} 
                transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} 
                className="w-2 h-2 bg-primary rounded-full" 
              />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// Invoice Scene - Glass Container with Elevated Card Styling
function InvoiceScene({ reducedMotion, isMobile }: SceneProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), isMobile ? 300 : 500),
      setTimeout(() => setStep(2), isMobile ? 800 : 1200),
      setTimeout(() => setStep(3), isMobile ? 1800 : 2500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [isMobile]);

  return (
    <div className="relative w-full max-w-sm sm:max-w-md mx-auto">
      <div className="bg-background/80 backdrop-blur-xl rounded-xl border border-border/50 shadow-2xl overflow-hidden">
        <div className="bg-muted/30 backdrop-blur-sm px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center"
              style={{ boxShadow: '0 0 10px hsl(var(--primary) / 0.2)' }}
            >
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <span className="font-medium text-sm">Invoice #1247</span>
          </div>
          {step >= 1 && (
            <motion.span
              initial={reducedMotion ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              className="text-xs bg-green-100/80 dark:bg-green-900/30 backdrop-blur-sm text-green-700 dark:text-green-300 px-2 py-1 rounded-full border border-green-200 dark:border-green-800"
            >
              Auto-Generated
            </motion.span>
          )}
        </div>
        
        <div className="p-4 space-y-4 bg-gradient-to-b from-background to-background/80">
          {/* Job Summary with elevated card styling */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: step >= 1 ? 1 : 0 }}
            className="space-y-2 bg-background/60 backdrop-blur-sm rounded-lg p-3 border border-border/50"
            style={{ boxShadow: '0 4px 20px hsl(var(--foreground) / 0.05)' }}
          >
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Emergency AC Repair</span>
              <span className="font-medium">$185.00</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Parts - Capacitor</span>
              <span className="font-medium">$45.00</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Labor (2 hrs)</span>
              <span className="font-medium">$150.00</span>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-2" />
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span>
              <span className="text-primary">$380.00</span>
            </div>
          </motion.div>

          {/* Customer Signature with improved animation */}
          {step >= 2 && (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-border/50 rounded-lg p-3 bg-background/60 backdrop-blur-sm"
            >
              <p className="text-xs text-muted-foreground mb-2">Customer Signature</p>
              <div className="h-14 bg-muted/30 rounded flex items-center justify-center overflow-hidden">
                <svg 
                  width="140" 
                  height="40" 
                  viewBox="0 0 140 40"
                  className="text-foreground"
                >
                  {/* First stroke - J */}
                  <motion.path
                    d="M15 10 Q15 30, 10 35 Q5 40, 8 35"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: reducedMotion ? 0.1 : 0.4 }}
                  />
                  {/* Main signature curve */}
                  <motion.path
                    d="M20 25 Q35 8, 50 22 T80 18 Q95 15, 105 22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: reducedMotion ? 0.1 : 0.6, delay: reducedMotion ? 0 : 0.4 }}
                  />
                  {/* Final flourish */}
                  <motion.path
                    d="M105 22 Q115 28, 125 20 L130 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: reducedMotion ? 0.1 : 0.3, delay: reducedMotion ? 0 : 1 }}
                  />
                </svg>
              </div>
            </motion.div>
          )}

          {/* Send Invoice with shimmer button and success glow */}
          {step >= 3 && (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-3"
            >
              {/* Shimmer send button */}
              <Button 
                className="w-full btn-shimmer"
                style={{ boxShadow: 'inset 0 0 20px hsl(var(--primary) / 0.15)' }}
              >
                <Send className="w-4 h-4 mr-2" />
                Send Invoice
              </Button>
              
              {/* Success states with animated checkmark glow */}
              <motion.div 
                className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
                initial={{ x: -20 }}
                animate={{ x: 0 }}
              >
                <motion.div
                  animate={reducedMotion ? {} : { x: [0, 5, 0] }}
                  transition={{ repeat: 2, duration: 0.3 }}
                  className="p-1 bg-green-500/10 rounded-full"
                  style={{ boxShadow: '0 0 10px hsl(142 76% 36% / 0.3)' }}
                >
                  <Send className="w-3 h-3" />
                </motion.div>
                <span>Invoice sent to johnson@email.com</span>
              </motion.div>
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <div 
                  className="p-1 bg-green-500/10 rounded-full"
                  style={{ boxShadow: '0 0 10px hsl(142 76% 36% / 0.3)' }}
                >
                  <CheckCircle2 className="w-3 h-3" />
                </div>
                <span>Job marked complete!</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// Completion CTA Component
function CompletionCTA() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring" }}
        className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4"
        style={{ boxShadow: '0 0 30px hsl(142 76% 36% / 0.3)' }}
      >
        <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
      </motion.div>
      <h3 className="text-xl font-bold mb-2">See the Full Platform</h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        Ready to streamline your field service operations?
      </p>
      <Button asChild size="lg" className="btn-shimmer">
        <Link to="/register">
          Join Waitlist
        </Link>
      </Button>
    </motion.div>
  );
}

interface InteractiveProductDemoProps {
  controlledScene?: number;
  onSceneChange?: (scene: number) => void;
  embedded?: boolean;
  disableAutoPlay?: boolean;
  hideControls?: boolean;
}

export function InteractiveProductDemo({ controlledScene, onSceneChange, embedded = false, disableAutoPlay = false, hideControls = false }: InteractiveProductDemoProps) {
  const [internalScene, setInternalScene] = useState(0);
  // Start with auto-play OFF - will be enabled when section becomes visible
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [hasBeenViewed, setHasBeenViewed] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  // Mark as loaded after initial render
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Intersection Observer: Start auto-play only when section becomes visible
  useEffect(() => {
    // Skip if already viewed, auto-play disabled, or externally controlled
    if (hasBeenViewed || disableAutoPlay || controlledScene !== undefined) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // First time becoming visible - reset to first slide and start auto-play
          setInternalScene(0);
          setIsAutoPlaying(true);
          setHasBeenViewed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 } // Trigger when 30% visible
    );
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, [hasBeenViewed, disableAutoPlay, controlledScene]);

  // Hide swipe hint after 2.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSwipeHint(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Use controlled scene if provided, otherwise use internal state
  const activeScene = controlledScene !== undefined ? controlledScene : internalScene;
  const setActiveScene = (scene: number | ((prev: number) => number)) => {
    const newScene = typeof scene === 'function' ? scene(activeScene) : scene;
    if (controlledScene !== undefined && onSceneChange) {
      onSceneChange(newScene);
    } else {
      setInternalScene(newScene);
    }
  };

  const sceneComponents = useMemo(() => [
    ServiceRequestScene,
    SchedulingScene,
    MobileScene,
    AIAssistantScene,
    InvoiceScene,
  ], []);

  // Stop auto-play when voice control takes over
  useEffect(() => {
    if (disableAutoPlay) {
      setIsAutoPlaying(false);
    }
  }, [disableAutoPlay]);

  // If we're being controlled externally, ensure completion state doesn't block scene changes
  useEffect(() => {
    if (controlledScene !== undefined) {
      setShowCompletion(false);
    }
  }, [controlledScene]);

  // Auto-advance scenes
  useEffect(() => {
    if (!isAutoPlaying || showCompletion || disableAutoPlay) return;
    
    const interval = setInterval(() => {
      setActiveScene((prev) => {
        if (prev === scenes.length - 1) {
          setShowCompletion(true);
          setIsAutoPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 3500);
    
    return () => clearInterval(interval);
  }, [isAutoPlaying, showCompletion, disableAutoPlay]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setActiveScene((prev) => Math.max(0, prev - 1));
        setIsAutoPlaying(false);
        setShowCompletion(false);
      } else if (e.key === "ArrowRight") {
        if (activeScene < scenes.length - 1) {
          setActiveScene((prev) => prev + 1);
        } else {
          setShowCompletion(true);
        }
        setIsAutoPlaying(false);
      } else if (e.key === " ") {
        e.preventDefault();
        setIsAutoPlaying((prev) => !prev);
        if (showCompletion) {
          setShowCompletion(false);
          setActiveScene(0);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeScene, showCompletion]);

  const handlePrevious = useCallback(() => {
    setActiveScene((prev) => Math.max(0, prev - 1));
    setIsAutoPlaying(false);
    setShowCompletion(false);
    setShowSwipeHint(false);
  }, []);

  const handleNext = useCallback(() => {
    if (activeScene < scenes.length - 1) {
      setActiveScene((prev) => prev + 1);
    } else {
      setShowCompletion(true);
    }
    setIsAutoPlaying(false);
    setShowSwipeHint(false);
  }, [activeScene]);

  // Swipe gesture support for mobile
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: () => {
      if (!showCompletion && activeScene < scenes.length - 1) {
        handleNext();
      }
    },
    onSwipeRight: () => {
      if (!showCompletion && activeScene > 0) {
        handlePrevious();
      }
    },
    threshold: 50,
  });

  const togglePlayPause = useCallback(() => {
    if (showCompletion) {
      setShowCompletion(false);
      setActiveScene(0);
      setIsAutoPlaying(true);
    } else {
      setIsAutoPlaying((prev) => !prev);
    }
  }, [showCompletion]);

  const ActiveSceneComponent = sceneComponents[activeScene];

  const demoContent = (
    <>
      {/* Controls - Compact Play/Pause + Progress Dots - Hidden when hideControls is true */}
      {!hideControls && (
        <div className={`flex items-center justify-center gap-2 ${embedded ? 'mb-3' : 'mb-6 sm:mb-8'}`}>
          {/* Play/Pause Button */}
          <button
            onClick={togglePlayPause}
            className="p-2 rounded-full bg-muted/80 backdrop-blur-sm hover:bg-muted transition-colors touch-manipulation border border-border/50"
            aria-label={isAutoPlaying ? "Pause demo" : "Play demo"}
          >
            {isAutoPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>

          {/* Progress Dots with Labels */}
          <div className="flex items-center gap-1 bg-background/60 backdrop-blur-sm rounded-full px-2 py-1 border border-border/50" role="tablist" aria-label="Demo steps">
            {scenes.map((scene, i) => (
              <button
                key={scene.id}
                role="tab"
                aria-selected={i === activeScene}
                aria-label={`Step ${i + 1}: ${scene.label}`}
                onClick={() => {
                  setActiveScene(i);
                  setIsAutoPlaying(false);
                  setShowCompletion(false);
                }}
                className="group relative flex flex-col items-center p-0.5 touch-manipulation"
              >
                <div 
                  className={`relative h-1.5 rounded-full transition-all duration-300 ${
                    i === activeScene ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                  style={i === activeScene ? { boxShadow: '0 0 8px hsl(var(--primary) / 0.5)' } : {}}
                >
                  {i === activeScene && isAutoPlaying && !showCompletion && (
                    <motion.div
                      className="absolute inset-0 bg-primary/50 rounded-full"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 3.5, ease: "linear" }}
                      style={{ transformOrigin: "left" }}
                      key={`${activeScene}-${isAutoPlaying}`}
                    />
                  )}
                </div>
                <span className={`text-[8px] mt-1 transition-opacity hidden md:block ${
                  i === activeScene ? "opacity-100" : "opacity-0 group-hover:opacity-70"
                }`}>
                  {scene.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {showCompletion ? (
          <motion.div
            key="completion"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CompletionCTA />
          </motion.div>
        ) : (
          <motion.div
            key="scenes"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className={`${embedded ? 'space-y-3' : 'grid lg:grid-cols-2 gap-8 lg:gap-12 items-center'}`}>
              {/* Scene Visualization with Side Navigation */}
              <div className={`relative ${embedded ? '' : 'order-2 lg:order-1'}`} role="tabpanel" aria-label={scenes[activeScene].title}>
                {/* Mobile Swipe Hint Animation - slides in from sides and fades out */}
                <AnimatePresence>
                  {showSwipeHint && !reducedMotion && (
                    <>
                      {/* Left swipe hint */}
                      <motion.div
                        initial={{ x: -40, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ 
                          x: { type: "spring", stiffness: 300, damping: 20 },
                          opacity: { duration: 0.3 }
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 sm:hidden pointer-events-none"
                      >
                        <motion.div
                          animate={{ x: [0, -8, 0] }}
                          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                          className="w-10 h-10 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30 flex items-center justify-center"
                          style={{ boxShadow: '0 0 15px hsl(var(--primary) / 0.2)' }}
                        >
                          <ChevronLeft className="w-5 h-5 text-primary" />
                        </motion.div>
                      </motion.div>
                      
                      {/* Right swipe hint */}
                      <motion.div
                        initial={{ x: 40, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ 
                          x: { type: "spring", stiffness: 300, damping: 20 },
                          opacity: { duration: 0.3 }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 sm:hidden pointer-events-none"
                      >
                        <motion.div
                          animate={{ x: [0, 8, 0] }}
                          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                          className="w-10 h-10 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30 flex items-center justify-center"
                          style={{ boxShadow: '0 0 15px hsl(var(--primary) / 0.2)' }}
                        >
                          <ChevronRight className="w-5 h-5 text-primary" />
                        </motion.div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                {/* Left Navigation Arrow */}
                {!hideControls && activeScene > 0 && (
                  <button
                    onClick={handlePrevious}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 md:-translate-x-6 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-background/90 backdrop-blur-sm border border-border/50 shadow-lg flex items-center justify-center hover:bg-muted transition-colors touch-manipulation"
                    aria-label="Previous scene"
                  >
                    <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                )}
                
                {/* Right Navigation Arrow */}
                {!hideControls && activeScene < scenes.length - 1 && (
                  <button
                    onClick={handleNext}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 md:translate-x-6 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-background/90 backdrop-blur-sm border border-border/50 shadow-lg flex items-center justify-center hover:bg-muted transition-colors touch-manipulation"
                    aria-label="Next scene"
                  >
                    <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                )}
                
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeScene}
                    initial={reducedMotion || isMobile ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reducedMotion || isMobile ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                    transition={{ duration: isMobile ? 0.15 : 0.3 }}
                    className="px-4 sm:px-8 md:px-12"
                  >
                    <ActiveSceneComponent reducedMotion={reducedMotion} isMobile={isMobile} />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Scene Description - Compact */}
              <div className={embedded ? '' : 'order-1 lg:order-2'}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeScene}
                    initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className={embedded ? 'space-y-2' : 'space-y-4'}
                  >
                    {/* Step indicator + Title inline */}
                    <div className="flex items-center gap-2">
                      <span 
                        className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-xs"
                        style={{ boxShadow: '0 0 10px hsl(var(--primary) / 0.3)' }}
                      >
                        {activeScene + 1}
                      </span>
                      <h3 className={`font-bold ${embedded ? 'text-base md:text-lg' : 'text-xl md:text-2xl'}`}>
                        {scenes[activeScene].title}
                      </h3>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {activeScene + 1}/{scenes.length}
                      </span>
                    </div>
                    
                    <p className={`text-muted-foreground ${embedded ? 'text-xs' : 'text-sm md:text-base'}`}>
                      {scenes[activeScene].description}
                    </p>
                    
                    {/* Bullet points - inline on mobile */}
                    <div className={`flex flex-wrap gap-x-3 gap-y-1 ${embedded ? '' : 'flex-col gap-y-2'}`}>
                      {scenes[activeScene].points.map((point, i) => (
                        <motion.div
                          key={point}
                          initial={reducedMotion ? false : { opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className={`flex items-center gap-1.5 ${embedded ? 'text-xs' : 'text-sm'}`}
                        >
                          <CheckCircle2 className={`text-primary flex-shrink-0 ${embedded ? 'w-3 h-3' : 'w-4 h-4'}`} />
                          <span>{point}</span>
                        </motion.div>
                      ))}
                    </div>

                    {/* Scene Navigation - Mobile-friendly buttons - Hidden when hideControls is true */}
                    {!hideControls && (
                      <div className="flex gap-3 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePrevious}
                          disabled={activeScene === 0}
                          className="h-10 px-4 text-sm touch-manipulation flex-1 sm:flex-none bg-background/60 backdrop-blur-sm"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Prev
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleNext}
                          className="h-10 px-4 text-sm touch-manipulation flex-1 sm:flex-none btn-shimmer"
                        >
                          {activeScene === scenes.length - 1 ? "Done" : "Next"}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    )}
                    
                    {/* Mobile swipe hint - only show initially */}
                    <p className="text-center text-xs text-muted-foreground mt-3 sm:hidden">
                      Swipe left or right to navigate
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  // Embedded mode - just return the content without section wrapper
  if (embedded) {
    return (
      <div 
        ref={containerRef}
        className="w-full min-h-[320px] sm:min-h-[400px] touch-pan-y"
        style={{ opacity: isLoaded ? 1 : 0.5, transition: 'opacity 0.2s ease-in' }}
        {...swipeHandlers}
      >
        {demoContent}
      </div>
    );
  }

  // Standalone mode - full section with header
  return (
    <section 
      ref={containerRef as React.RefObject<HTMLElement>}
      className="py-24 px-4 bg-gradient-to-b from-background via-muted/30 to-background touch-pan-y"
      aria-label="Interactive product demonstration"
      {...swipeHandlers}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span 
            className="inline-flex items-center gap-2 text-sm font-medium text-primary bg-primary/10 backdrop-blur-sm px-4 py-1.5 rounded-full mb-4 border border-primary/20"
            style={{ boxShadow: '0 0 15px hsl(var(--primary) / 0.15)' }}
          >
            <Sparkles className="w-4 h-4" />
            See It In Action
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Watch a Job Flow From Start to Finish
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Experience how FieldTek streamlines every step of your service workflow
          </p>
        </motion.div>

        {demoContent}
        
        {/* Keyboard hint - Hidden on mobile */}
        <p className="hidden sm:block text-center text-xs text-muted-foreground mt-8">
          Use arrow keys to navigate, space to play/pause
        </p>
      </div>
    </section>
  );
}

export default InteractiveProductDemo;
