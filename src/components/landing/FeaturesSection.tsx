import { motion } from "framer-motion";
import { ClipboardCheck, FileText, Shield } from "lucide-react";
import { memo } from "react";
import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";

const pillars = [
  {
    icon: ClipboardCheck,
    title: "AI-Guided Installs",
    description:
      "Step-by-step procedures pulled directly from manufacturer documentation. Your technicians follow the spec every time — no guesswork, no missed steps.",
  },
  {
    icon: FileText,
    title: "Automatic Documentation",
    description:
      "Every step is captured, timestamped, and stored. Compliance-ready documentation is generated automatically — no extra work for your techs.",
  },
  {
    icon: Shield,
    title: "Warranty Protection",
    description:
      "Compliance verification against manufacturer requirements before the job closes. Catch warranty-voiding mistakes before they cost you money.",
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

export const FeaturesSection = memo(function FeaturesSection() {
  return (
    <section id="features" className="bg-[#111214] py-16 md:py-28 lg:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <AnimatedEyebrow label="The Solution" center />
          <ScrollReveal delay={0.05}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15]">
              Three pillars of reliable field service
            </h2>
          </ScrollReveal>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {pillars.map((pillar, i) => (
            <motion.div
              key={i}
              variants={staggerItem}
              className="rounded-xl border border-white/[0.04] bg-[#161819] p-5 md:p-8 hover:bg-[#1a1c1d] transition-colors duration-300 card-hover-lift"
            >
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-orange-500/10 flex items-center justify-center mb-5">
                <pillar.icon className="h-5 w-5 md:h-6 md:w-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{pillar.title}</h3>
              <p className="text-zinc-400 leading-relaxed">{pillar.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
});
