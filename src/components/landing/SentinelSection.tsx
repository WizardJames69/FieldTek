import { BookOpen, Network, GitBranch, Brain, MessageSquare, FileSearch, BadgeCheck, UserCheck } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";
import { IsometricLights } from "./IsometricLights";
import sentinelShot from "@/assets/landing/sentinel-conversation.webp";

/**
 * The single Sentinel story section. Consolidates the three former,
 * back-to-back Sentinel sections (an intro, an abstract loop diagram, and a
 * reasoning walkthrough) into one narrative: the live diagnosis demo leads, a
 * plain-language four-step flow replaces the old seven-node pipeline diagram,
 * and the capability list carries the honest-claims copy. This is the page's
 * peak moment, so it gets more vertical room than the sections around it.
 */

// Plain-language flow. Four steps, one line each. Visible on mobile too
// (the old pipeline/loop diagrams were desktop-only).
const flowSteps = [
  { icon: MessageSquare, label: "Technician asks", detail: "A real question from the field" },
  { icon: FileSearch, label: "Your manuals searched", detail: "Uploaded docs, specs, and history" },
  { icon: BadgeCheck, label: "Cited answer", detail: "Exact page and paragraph to check" },
  { icon: UserCheck, label: "Team sign-off", detail: "Lessons reviewed before reuse" },
];

const capabilities = [
  {
    icon: BookOpen,
    title: "Manual-Grounded Guidance",
    description:
      "Sentinel reads your uploaded manuals and answers with the exact procedure, page, and paragraph. When it isn't sure, it says so instead of guessing.",
  },
  {
    icon: Network,
    title: "Equipment Context",
    description:
      "Every unit's model, serial, specs, and full service history in one place: the context Sentinel draws on when answering about your equipment.",
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
      "Built to learn: reviewed lessons from completed jobs become citable knowledge, approved by your team and cited like any manual.",
  },
];

export function SentinelSection() {
  return (
    <section
      id="ai-platform"
      className="landing-section-dark landing-ai-glow relative py-16 md:py-24 lg:py-28"
    >
      <IsometricLights />
      <div className="mx-auto max-w-6xl px-4 relative z-[1]">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <ScrollReveal>
            <h2 className="font-landing-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15] text-balance">
              Your documentation. Your history. Grounded answers on every job.
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.08}>
            <p className="text-base md:text-lg text-zinc-400 leading-relaxed mt-4 max-w-2xl mx-auto">
              Watch Sentinel work a real symptom: it searches your uploaded manuals and
              your repair history, ranks the likely causes, and shows the technician
              exactly where the answer came from.
            </p>
          </ScrollReveal>
        </div>

        {/* The demo IS the argument: a real grounded conversation, not a mockup. */}
        <ScrollReveal delay={0.1}>
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-white/[0.06] bg-[#111214] p-3 shadow-lg shadow-black/30">
              <div className="rounded-xl overflow-hidden bg-[#111113]">
                <img
                  src={sentinelShot}
                  alt="Sentinel AI answering a technician's question about weak cooling on a Carrier air handler, with four page-level citations to the installation manual and a high-confidence indicator"
                  width={2200}
                  height={1560}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto"
                />
              </div>
            </div>
            <p className="text-xs text-zinc-500 text-center mt-3">
              Product shown with sample data.
            </p>
          </div>
        </ScrollReveal>

        {/* Plain-language flow: how an answer is produced */}
        <div className="max-w-4xl mx-auto mt-12 md:mt-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {flowSteps.map((step, i) => (
              <ScrollReveal key={step.label} delay={0.05 + i * 0.06}>
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 h-full">
                  <step.icon className="h-4 w-4 text-orange-500 mb-2.5" aria-hidden="true" />
                  <p className="text-sm font-semibold text-white leading-snug">{step.label}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed mt-1">{step.detail}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <ScrollReveal delay={0.2}>
            <p className="text-sm text-zinc-500 text-center mt-5 max-w-2xl mx-auto">
              Built to learn from completed jobs, with your team in control: nothing
              enters your knowledge base without human sign-off. We are proving this
              loop with our design partners now.
            </p>
          </ScrollReveal>
        </div>

        {/* Capabilities */}
        <div className="max-w-4xl mx-auto mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-7">
          {capabilities.map((cap, i) => (
            <ScrollReveal key={cap.title} delay={0.05 + i * 0.05}>
              <div className="flex items-start gap-4">
                <div className="h-9 w-9 shrink-0 rounded-lg bg-orange-500/10 flex items-center justify-center mt-0.5">
                  <cap.icon className="h-4 w-4 text-orange-500" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-landing-display text-base font-semibold text-white mb-1">{cap.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{cap.description}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
