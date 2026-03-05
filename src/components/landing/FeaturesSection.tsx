import { motion } from "framer-motion";
import { ClipboardCheck, FileText, Shield } from "lucide-react";
import { memo } from "react";

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

export const FeaturesSection = memo(function FeaturesSection() {
  return (
    <section id="features" className="bg-[#111214] py-16 md:py-28 lg:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center max-w-3xl mx-auto mb-12 md:mb-16"
        >
          <p className="landing-eyebrow text-zinc-500 mb-4">The Solution</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15]">
            Three pillars of reliable field service
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pillars.map((pillar, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.1 }}
              className="rounded-xl border border-white/[0.06] bg-[#161819] p-5 md:p-8 hover:border-white/[0.12] transition-all duration-300"
            >
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-orange-500/10 flex items-center justify-center mb-5">
                <pillar.icon className="h-5 w-5 md:h-6 md:w-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{pillar.title}</h3>
              <p className="text-zinc-400 leading-relaxed">{pillar.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
});
