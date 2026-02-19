import { motion } from "framer-motion";
import { Target, ShieldCheck, Brain, Zap, CheckCircle } from "lucide-react";
import { memo } from "react";
import { useReducedAnimations } from "@/hooks/useReducedAnimations";
import { FloatingOrbs } from "./FloatingOrbs";
import { Card3D } from "./Card3D";

const comparisons = [
  {
    title: "Get It Right the First Time",
    icon: Target,
    beforeText: "Guesswork, memory, callbacks",
    afterText: "AI-guided installs and troubleshooting",
    supportLine: "Step-by-step guidance based on manufacturer manuals",
  },
  {
    title: "Works Without Signal",
    icon: ShieldCheck,
    beforeText: "Lost work in dead zones",
    afterText: "Full offline mode with auto-sync",
    supportLine: "Technicians stay productive in basements and remote sites",
  },
  {
    title: "Automated Maintenance Schedules",
    icon: Brain,
    beforeText: "Manual calendar reminders",
    afterText: "Auto-generated recurring jobs",
    supportLine: "PM contracts run themselves—jobs created automatically",
  },
  {
    title: "Live the Same Day",
    icon: Zap,
    beforeText: "6+ month implementations",
    afterText: "Productive in minutes",
    supportLine: "No consultants, no retraining, no disruption",
  },
];

const switchReasons = [
  "No annual contracts",
  "Free data migration",
  "Dedicated support",
];

export const ComparisonSection = memo(function ComparisonSection() {
  const reducedMotion = useReducedAnimations();

  return (
    <section className="relative py-16 md:py-24 bg-background overflow-hidden layered-bg">
      {/* Floating background orbs */}
      <FloatingOrbs variant="mixed" count={2} intensity="medium" />


      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.3 }}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Built Different
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            FieldTek Fixes What Traditional Field Software Misses
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Standardize installs, reduce callbacks, and protect warranties — without months of setup or retraining.
          </p>
        </motion.div>

        {/* Outcome-Driven Cards Grid with 3D effect */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 max-w-6xl mx-auto mb-14">
          {comparisons.map((item) => (
              <Card3D key={item.title} intensity={0.4} glowOnHover>
                <div className="bg-card border border-border rounded-2xl p-6 md:p-7 hover:shadow-xl hover:shadow-primary/5 transition-all hover:border-primary/30 group h-full flex flex-col">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>

                  {/* Title */}
                  <h3 className="text-lg md:text-xl font-bold text-foreground mb-4">
                    {item.title}
                  </h3>

                  {/* Before/After */}
                  <div className="space-y-3 flex-grow">
                    {/* Before - muted */}
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide shrink-0 mt-0.5">Before:</span>
                      <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/40">
                        {item.beforeText}
                      </span>
                    </div>

                    {/* After - prominent */}
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-primary uppercase tracking-wide shrink-0 mt-0.5">After:</span>
                      <span className="text-sm font-semibold text-foreground">
                        {item.afterText}
                      </span>
                    </div>
                  </div>

                  {/* Support Line */}
                  <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border/50">
                    {item.supportLine}
                  </p>
                </div>
              </Card3D>
          ))}
        </div>

        {/* Switch Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3 }}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {switchReasons.map((reason) => (
              <span
                key={reason}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-muted/50 text-muted-foreground text-sm font-medium rounded-full"
              >
                <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                {reason}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
});
