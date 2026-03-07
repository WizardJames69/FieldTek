import { motion } from "framer-motion";
import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";

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
      "Give your clients a branded portal to submit service requests, track job status, and approve quotes. No phone calls or emails needed.",
  },
  {
    number: "04",
    title: "Deploy to Your Team",
    description:
      "Your technicians get a mobile app with offline support, Sentinel AI-guided procedures, and automatic documentation. Productive from day one.",
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

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-[#0C0D0F] py-16 md:py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <AnimatedEyebrow label="Get Started" center />
          <ScrollReveal delay={0.05}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15]">
              Up and running in four steps
            </h2>
          </ScrollReveal>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
        >
          {steps.map((step, i) => (
            <motion.div
              key={i}
              variants={staggerItem}
              className="relative rounded-xl bg-[#111214] border border-white/[0.06] p-6 md:p-7"
              style={{
                borderLeftWidth: "2px",
                borderImage: "linear-gradient(to bottom, #F97316, transparent 70%) 1",
              }}
            >
              <div className="text-base font-semibold text-orange-500 font-mono tabular-nums mb-2">
                {step.number}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-[15px] text-[#9CA3AF] leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
