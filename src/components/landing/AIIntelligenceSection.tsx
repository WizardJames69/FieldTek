import { motion } from "framer-motion";
import { BookOpen, Network, GitBranch, Brain } from "lucide-react";
import { DisplayCards } from "./DisplayCards";
import { IsometricLights } from "./IsometricLights";
import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";

const capabilities = [
  {
    icon: BookOpen,
    title: "RAG over Documentation",
    description:
      "Upload manuals. AI retrieves relevant procedures in real-time.",
  },
  {
    icon: Network,
    title: "Equipment Knowledge Graph",
    description:
      "Maps equipment models, components, failure modes, and proven fixes.",
  },
  {
    icon: GitBranch,
    title: "Workflow Intelligence",
    description:
      "Surfaces best practices from how your top technicians work.",
  },
  {
    icon: Brain,
    title: "Diagnostic Learning Loop",
    description:
      "Learns from real repair outcomes to improve recommendations.",
  },
];

export function AIIntelligenceSection() {
  return (
    <section id="ai-platform" className="landing-section-dark landing-ai-glow py-16 md:py-20 lg:py-28 relative">
      <IsometricLights />
      <div className="mx-auto max-w-6xl px-4 relative z-[1]">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left: Text content */}
          <div className="lg:w-1/2">
            <AnimatedEyebrow label="Beyond the Basics" />
            <ScrollReveal delay={0.05}>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15] mb-4">
                An AI platform that learns from every job
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="text-lg text-zinc-400 leading-relaxed mb-10">
                FieldTek isn't just a checklist tool. It's an intelligence layer that gets smarter
                with every technician interaction, every repair, and every document you upload.
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
