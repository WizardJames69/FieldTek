import { motion } from "framer-motion";
import { ClipboardCheck, FileText, Shield } from "lucide-react";
import { memo } from "react";

const pillars = [
  {
    icon: ClipboardCheck,
    title: "AI-Guided Installs",
    description:
      "Step-by-step procedures pulled directly from manufacturer documentation. Your technicians follow the spec every time — no guesswork, no missed steps.",
    features: [
      "Interactive checklists from OEM manuals",
      "Real-time validation flags unsafe or missing data",
      "Startup and commissioning workflows",
      "Offline-capable for basements and remote sites",
    ],
  },
  {
    icon: FileText,
    title: "Automatic Documentation",
    description:
      "Every step is captured, timestamped, and stored. Compliance-ready documentation is generated automatically — no extra work for your techs.",
    features: [
      "Auto-generated service reports",
      "Timestamped completion records",
      "Photo and measurement capture",
      "Exportable for audits and inspections",
    ],
  },
  {
    icon: Shield,
    title: "Warranty Protection",
    description:
      "Compliance verification against manufacturer requirements before the job closes. Catch warranty-voiding mistakes before they cost you money.",
    features: [
      "Manufacturer spec compliance checks",
      "Warranty expiration tracking",
      "Installation verification against OEM standards",
      "Proactive alerts before warranties lapse",
    ],
  },
];

export const FeaturesSection = memo(function FeaturesSection() {
  return (
    <section id="features" className="landing-section-light-muted py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <p className="landing-eyebrow text-zinc-400 mb-4">The Solution</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900 leading-[1.15]">
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
              className="rounded-xl border border-zinc-200 bg-white p-8 hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-200/50 transition-all duration-200"
            >
              <div className="h-12 w-12 rounded-xl bg-orange-50 flex items-center justify-center mb-5">
                <pillar.icon className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-900 mb-3">{pillar.title}</h3>
              <p className="text-zinc-500 leading-relaxed mb-6">{pillar.description}</p>
              <ul className="space-y-2.5">
                {pillar.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm text-zinc-600">
                    <div className="h-1.5 w-1.5 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
});
