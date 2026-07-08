import { motion } from "framer-motion";
import { AlertTriangle, FileX, UserMinus, RotateCcw } from "lucide-react";
import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";

const problems = [
  {
    icon: AlertTriangle,
    title: "Failed Installs & Callbacks",
    description:
      "Specs get missed when techs work from memory. The result: warranty voids, callbacks, and lost revenue.",
  },
  {
    icon: FileX,
    title: "No Documentation Trail",
    description:
      "Work gets done but nothing is recorded, so there's no proof when an inspector or warranty claim asks.",
  },
  {
    icon: UserMinus,
    title: "Knowledge Walks Out the Door",
    description:
      "When your best tech retires, decades of know-how leave with them. New hires start from scratch.",
  },
  {
    icon: RotateCcw,
    title: "Diagnostics Start From Scratch",
    description:
      "Every tech troubleshoots the same symptoms again, because nothing captures what actually worked.",
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

export function ProblemSection() {
  return (
    <section className="bg-[#0C0D0F] py-6 md:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-16">
          <AnimatedEyebrow label="The Problem" center />
          <ScrollReveal delay={0.05}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-[-0.02em] text-white leading-[1.15] text-balance">
              Field service runs on paper, memory, and hope
            </h2>
          </ScrollReveal>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8"
        >
          {problems.map((problem, i) => (
            <motion.div
              key={i}
              variants={staggerItem}
              className="border-l-[3px] border-orange-500 pl-4 md:pl-6 max-md:rounded-r-xl max-md:bg-white/[0.02] max-md:py-4 max-md:pr-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <problem.icon className="h-5 w-5 text-zinc-400" />
                <h3 className="text-lg font-semibold text-white">{problem.title}</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{problem.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
