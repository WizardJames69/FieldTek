import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, FlaskConical, ShieldCheck, Hammer, MessageSquare, BadgePercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "./ScrollReveal";

interface EarlyAccessSectionProps {
  onApply?: () => void;
}

// What a design partner actually gets. The founding-member discount and the
// 48-hour response promise used to live only inside the application modal;
// they belong on the page. Copy must stay inside honest-claims boundaries.
const partnerBenefits = [
  {
    icon: Hammer,
    title: "Shape the product",
    description: "Your feedback directly influences what we build next.",
  },
  {
    icon: MessageSquare,
    title: "Direct line to the builder",
    description: "Founder-guided onboarding and a response within 48 hours during the alpha.",
  },
  {
    icon: BadgePercent,
    title: "Founding member pricing",
    description: "50% off your first year when paid plans launch, locked in for applying early.",
  },
];

// Honest roadmap framing: shipped today vs shaped in alpha vs data ownership.
// Copy here must stay within the PR-COPY-1 claim boundaries.
const roadmapCards = [
  {
    icon: CheckCircle2,
    label: "Today",
    labelClass: "text-zinc-300",
    iconClass: "text-zinc-400",
    body: "Grounded answers with citations, job records, photo evidence, scheduling, client portal, invoicing, and offline-capable mobile access.",
  },
  {
    icon: FlaskConical,
    label: "In alpha",
    labelClass: "text-orange-500",
    iconClass: "text-orange-500",
    body: "Compliance guidance, service reports, and reviewed intelligence loops are being shaped with early field teams.",
  },
  {
    icon: ShieldCheck,
    label: "Your data",
    labelClass: "text-zinc-300",
    iconClass: "text-zinc-400",
    body: "Tenant-isolated by design. Your documents are never used to train shared models.",
  },
];

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

export function EarlyAccessSection({ onApply }: EarlyAccessSectionProps) {
  return (
    <section className="bg-[var(--landing-surface-raised)] py-6 md:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center mb-12 md:mb-16">
          <ScrollReveal>
            <h2 className="font-landing-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white text-balance">
              Built with a small group of contractors, not for a waitlist
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto mt-4">
              We're partnering with a handful of field service teams before public launch.
              You get founder-level support and founding-member pricing; we get your honest feedback.
            </p>
          </ScrollReveal>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 mb-10"
        >
          {partnerBenefits.map((benefit) => (
            <motion.div
              key={benefit.title}
              variants={staggerItem}
              className="rounded-xl bg-[var(--landing-surface-raised)] border border-white/[0.06] p-6 md:p-7"
            >
              <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center mb-4">
                <benefit.icon className="h-4 w-4 text-orange-500" aria-hidden="true" />
              </div>
              <h3 className="font-landing-display text-lg font-semibold text-white mb-2">{benefit.title}</h3>
              <p className="text-[15px] text-zinc-400 leading-relaxed">{benefit.description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Honest roadmap framing, styled to match the benefit card system */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 mb-10"
        >
          {roadmapCards.map((card) => (
            <motion.div
              key={card.label}
              variants={staggerItem}
              className="rounded-xl bg-[var(--landing-surface)] border border-white/[0.06] p-5 md:p-6"
            >
              <div className="flex items-center gap-2 mb-3">
                <card.icon className={`h-4 w-4 ${card.iconClass}`} aria-hidden="true" />
                <span className={`text-xs font-semibold uppercase tracking-widest ${card.labelClass}`}>
                  {card.label}
                </span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{card.body}</p>
            </motion.div>
          ))}
        </motion.div>

        <ScrollReveal delay={0.15}>
          <div className="text-center">
            <Button size="lg" variant="cool" onClick={onApply}>
              Apply for Early Access
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-xs text-zinc-500 mt-3">
              A short application. We reply to every one within 48 hours.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
