import { motion } from "framer-motion";
import { Upload, Settings, Rocket } from "lucide-react";

const steps = [
  {
    number: "1",
    icon: Upload,
    title: "Upload Your Documentation",
    description:
      "Upload equipment manuals, service procedures, and compliance standards. The AI indexes everything for instant retrieval.",
  },
  {
    number: "2",
    icon: Settings,
    title: "Configure Your Workflows",
    description:
      "Set up jobs, checklists, compliance rules, and recurring maintenance schedules. Assign technicians and define territories.",
  },
  {
    number: "3",
    icon: Rocket,
    title: "Deploy to Your Team",
    description:
      "Your technicians get a mobile app with offline support, AI-guided procedures, and automatic documentation — productive from day one.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="landing-section-light-muted py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <p className="landing-eyebrow text-zinc-400 mb-4">Get Started</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900 leading-[1.15]">
            Up and running in three steps
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-white border border-zinc-200 mb-5 shadow-sm">
                <step.icon className="h-6 w-6 text-orange-500" />
              </div>
              <div className="text-sm font-bold text-orange-500 mb-2">Step {step.number}</div>
              <h3 className="text-xl font-semibold text-zinc-900 mb-3">{step.title}</h3>
              <p className="text-zinc-500 leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Connector lines (desktop only) */}
        <div className="hidden md:flex items-center justify-center mt-[-200px] mb-[120px] px-12 pointer-events-none" aria-hidden>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent" />
        </div>
      </div>
    </section>
  );
}
