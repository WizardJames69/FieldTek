import { motion } from "framer-motion";
import { BookOpen, Network, GitBranch, Brain } from "lucide-react";
import { DisplayCards } from "./DisplayCards";
import { IsometricLights } from "./IsometricLights";
import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";

const capabilities = [
  {
    icon: BookOpen,
    title: "Manual-Grounded Guidance",
    description:
      "Sentinel reads your uploaded manuals and answers with the exact procedure, page, and paragraph. When it isn't sure, it says so — no confident guessing.",
  },
  {
    icon: Network,
    title: "Equipment Context",
    description:
      "Every unit's model, serial, specs, and full service history in one place — the context Sentinel draws on when answering about your equipment.",
  },
  {
    icon: GitBranch,
    title: "Pattern Recognition",
    description:
      "Coming with our design partners: repair patterns surfaced from completed jobs, reviewed by your team before they shape the guidance techs see.",
  },
  {
    icon: Brain,
    title: "Compounding Intelligence",
    description:
      "Built to learn: reviewed lessons from completed jobs become citable knowledge — approved by your team, cited like any manual.",
  },
];

export function AIIntelligenceSection() {
  return (
    <section id="ai-platform" className="landing-section-dark landing-ai-glow py-6 md:py-8 lg:py-10 relative">
      <IsometricLights />
      <div className="mx-auto max-w-6xl px-4 relative z-[1]">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left: Text content */}
          <div className="lg:w-1/2">
            <AnimatedEyebrow label="FieldTek Intelligence" />
            <ScrollReveal delay={0.05}>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15] mb-4">
                Your documentation. Your history. Grounded answers on every job.
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="text-lg text-zinc-400 leading-relaxed mb-10">
                Sentinel AI reads your uploaded manuals, cross-references your repair history, and delivers guidance grounded in real equipment data. Every completed job makes the next diagnosis more accurate.
              </p>
            </ScrollReveal>

            <div className="space-y-5">
              {capabilities.map((cap, i) => (
                <ScrollReveal key={i} delay={0.15 + i * 0.08}>
                  <div className="flex items-start gap-4">
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-orange-500/10 flex items-center justify-center mt-0.5">
                      <cap.icon className="h-4.5 w-4.5 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white mb-1">{cap.title}</h3>
                      <p className="text-sm text-zinc-400 leading-relaxed">{cap.description}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>

          {/* Right: DisplayCards visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lg:w-1/2 flex justify-center scale-[0.85] sm:scale-100 origin-top"
          >
            <DisplayCards />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
