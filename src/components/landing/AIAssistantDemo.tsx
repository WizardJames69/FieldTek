import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect, memo } from "react";
import { Bot, User, Zap, FileText, ShieldCheck, BookOpen, Database, Scale } from "lucide-react";
import { useReducedAnimations } from "@/hooks/useReducedAnimations";

const chatMessages = [
  {
    role: "user" as const,
    message: "Carrier 24ACC636 not cooling. Compressor running but no cold air.",
    icon: User,
  },
  {
    role: "assistant" as const,
    message: "I found the service manual for Carrier 24ACC636. Looking at this unit's history, I see 2 previous refrigerant-related calls in the past 6 months. ⚠️ This pattern suggests a persistent leak. Let's check pressures — what are your high and low side readings?",
    icon: Bot,
    source: "Carrier Manual + Service History",
  },
  {
    role: "user" as const, 
    message: "High side: 150 PSI, Low side: 45 PSI",
    icon: User,
  },
  {
    role: "assistant" as const,
    message: "Per the Carrier spec sheet, normal readings should be 225-250 PSI (high) and 65-70 PSI (low). Your readings confirm low refrigerant. Based on similar repairs, you'll likely need a TXV valve and refrigerant recharge. ⚠️ Note: Warranty expires in 23 days — document thoroughly.",
    icon: Bot,
    highlight: true,
    source: "Carrier Specs + Parts History + Warranty",
  },
  {
    role: "user" as const,
    message: "What's the NEC clearance requirement for a 200A residential panel?",
    icon: User,
  },
  {
    role: "assistant" as const,
    message: "Per NEC Section 110.26(A), you need a minimum of 36 inches of clear working space in front of the panel, 30 inches wide, and headroom of 6.5 feet. For a 200A panel (150–600V), the depth must be at least 36 inches.",
    icon: Bot,
    source: "NEC 110.26(A) — Code Reference",
  },
];

const trustFeatures = [
  {
    icon: FileText,
    title: "Manufacturer Manuals",
    description: "Trained on installation guides and equipment specifications from manufacturers"
  },
  {
    icon: BookOpen,
    title: "Service Documentation",
    description: "Access troubleshooting workflows, commissioning procedures, and best practices"
  },
  {
    icon: ShieldCheck,
    title: "Warranty-Safe Responses",
    description: "Manual-verified answers that protect warranties and eliminate guesswork on site"
  },
  {
    icon: Database,
    title: "Service History Intelligence",
    description: "AI references past repairs to identify patterns and predict likely parts needed"
  },
  {
    icon: Scale,
    title: "Code Compliance Reference",
    description: "Instant access to NEC, IPC, IMC, CEC, and CSA building codes — no document uploads required"
  },
];

export const AIAssistantDemo = memo(function AIAssistantDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.2 });
  const reducedMotion = useReducedAnimations();
  const [visibleMessages, setVisibleMessages] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    // On mobile/reduced motion: show all messages faster
    const delay = reducedMotion ? 800 : 1500;
    const messageTimers: NodeJS.Timeout[] = [];
    
    chatMessages.forEach((_, index) => {
      const timer = setTimeout(() => {
        setVisibleMessages(index + 1);
      }, delay * (index + 1));
      messageTimers.push(timer);
    });

    return () => messageTimers.forEach(clearTimeout);
  }, [isInView, reducedMotion]);

  return (
    <section ref={containerRef} className="relative py-12 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.3 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
            <ShieldCheck className="h-4 w-4" />
            Manual-Verified & Warranty-Safe
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            AI Field Assistant Trained on Your Documentation
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
            Technicians interact with an AI chat assistant trained on manufacturer installation manuals, 
            service and troubleshooting documentation, and 
            <span className="text-primary font-medium"> equipment-specific best practices</span>.
          </p>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Responses are manual-verified and warranty-safe — reducing risk and eliminating guesswork on site.
          </p>
        </motion.div>

        {/* Trust features */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.3 }}
          className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 max-w-6xl mx-auto mb-12"
        >
          {trustFeatures.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">{feature.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{feature.description}</p>
              </div>
            </div>
          ))}
        </motion.div>

        <div className="max-w-2xl mx-auto">
          {/* Phone mockup */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.3 }}
            className="relative"
          >
            {/* Phone frame */}
            <div className="bg-foreground/90 rounded-[2.5rem] p-3 shadow-2xl shadow-primary/20">
              <div className="bg-background rounded-[2rem] overflow-hidden">
                {/* Status bar */}
                <div className="bg-muted/50 px-6 py-3 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Field Assistant</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Database className="h-3 w-3" />
                        Connected to your docs
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
                    <ShieldCheck className="h-3 w-3" />
                    Verified
                  </div>
                </div>

                {/* Chat area */}
                <div className="p-4 space-y-4 min-h-[400px] bg-gradient-to-b from-background to-muted/20">
                  {chatMessages.slice(0, visibleMessages).map((msg, index) => (
                    <motion.div
                      key={index}
                      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === "user" 
                          ? "bg-secondary text-secondary-foreground" 
                          : "bg-primary text-primary-foreground"
                      }`}>
                        <msg.icon className="h-4 w-4" />
                      </div>
                      <div className={`max-w-[80%] ${msg.role === "user" ? "" : "space-y-1"}`}>
                        <div className={`rounded-2xl px-4 py-3 ${
                          msg.role === "user"
                            ? "bg-secondary text-secondary-foreground rounded-tr-sm"
                            : msg.highlight 
                              ? "bg-primary/10 border border-primary/20 text-foreground rounded-tl-sm"
                              : "bg-muted text-foreground rounded-tl-sm"
                        }`}>
                          <p className="text-sm leading-relaxed">{msg.message}</p>
                        </div>
                        {/* Source citation for assistant messages */}
                        {"source" in msg && msg.source && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                            <FileText className="h-3 w-3" />
                            <span>{msg.source}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {/* Simple typing indicator */}
                  {visibleMessages < chatMessages.length && isInView && (
                    <div className={`flex gap-3 ${visibleMessages % 2 === 0 ? "flex-row-reverse" : ""}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        visibleMessages % 2 === 0
                          ? "bg-secondary text-secondary-foreground"
                          : "bg-primary text-primary-foreground"
                      }`}>
                        {visibleMessages % 2 === 0 ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </div>
                      <div className={`rounded-2xl px-4 py-3 ${
                        visibleMessages % 2 === 0
                          ? "bg-secondary rounded-tr-sm"
                          : "bg-muted rounded-tl-sm"
                      }`}>
                        <div className="flex gap-1">
                          <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse"></span>
                          <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                          <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input area */}
                <div className="p-4 border-t border-border bg-background">
                  <div className="flex items-center gap-2 bg-muted rounded-full px-4 py-3">
                    <input 
                      type="text" 
                      placeholder="Ask about any equipment..."
                      className="flex-1 bg-transparent text-sm text-muted-foreground outline-none"
                      disabled
                    />
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <Zap className="h-4 w-4 text-primary-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Static decorative elements */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary/20 rounded-full blur-2xl -z-10" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-secondary/20 rounded-full blur-2xl -z-10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
});
