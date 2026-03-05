import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Upload Your Documentation",
    description:
      "Upload equipment manuals, service procedures, and compliance standards. Indexed by AI for instant retrieval.",
  },
  {
    number: "02",
    title: "Configure Your Workflows",
    description:
      "Set up jobs, checklists, compliance rules, and recurring maintenance schedules. Assign technicians and define territories.",
  },
  {
    number: "03",
    title: "Share Your Client Portal",
    description:
      "Give your clients a branded portal to submit service requests, track job status, and approve quotes — no phone calls or emails needed.",
  },
  {
    number: "04",
    title: "Deploy to Your Team",
    description:
      "Your technicians get a mobile app with offline support, AI-guided procedures, and automatic documentation — productive from day one.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-[#0C0D0F] py-16 md:py-28 lg:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center max-w-3xl mx-auto mb-12 md:mb-16"
        >
          <p className="landing-eyebrow text-zinc-500 mb-4">Get Started</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15]">
            Up and running in four steps
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.1 }}
            >
              <div className="text-3xl md:text-4xl font-bold font-mono text-orange-500 mb-4">{step.number}</div>
              <h3 className="text-lg font-semibold text-white mb-3">{step.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
