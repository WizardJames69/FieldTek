import { motion } from "framer-motion";
import { AlertTriangle, FileX, UserMinus } from "lucide-react";

const problems = [
  {
    icon: AlertTriangle,
    title: "Failed Installs & Callbacks",
    description:
      "Technicians miss manufacturer specs because they're working from memory. The result: warranty voids, callbacks, and lost revenue.",
  },
  {
    icon: FileX,
    title: "No Documentation Trail",
    description:
      "Work gets done but nothing is recorded. When a warranty claim comes in or an inspector asks questions, there's no proof of compliance.",
  },
  {
    icon: UserMinus,
    title: "Knowledge Walks Out the Door",
    description:
      "When your best tech retires, decades of institutional knowledge leave with them. New hires start from scratch every time.",
  },
];

export function ProblemSection() {
  return (
    <section className="bg-[#0C0D0F] py-16 md:py-28 lg:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center max-w-3xl mx-auto mb-12 md:mb-16"
        >
          <p className="landing-eyebrow text-zinc-500 mb-4">The Problem</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-[-0.02em] text-white leading-[1.15]">
            Field service runs on paper, memory, and hope
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {problems.map((problem, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.1 }}
              className="border-l-[3px] border-orange-500 pl-4 md:pl-6"
            >
              <div className="flex items-center gap-3 mb-3">
                <problem.icon className="h-5 w-5 text-zinc-400" />
                <h3 className="text-lg font-semibold text-white">{problem.title}</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{problem.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
