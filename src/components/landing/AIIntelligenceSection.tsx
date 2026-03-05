import { motion } from "framer-motion";
import { BookOpen, Network, GitBranch, Brain } from "lucide-react";

const capabilities = [
  {
    icon: BookOpen,
    title: "RAG over Documentation",
    description:
      "Upload equipment manuals and service documentation. The AI retrieves relevant procedures, specs, and troubleshooting steps in real-time — grounded in your actual manufacturer data.",
  },
  {
    icon: Network,
    title: "Equipment Knowledge Graph",
    description:
      "Maps the relationships between equipment models, components, failure modes, and proven fixes. The system understands what's connected to what.",
  },
  {
    icon: GitBranch,
    title: "Workflow Intelligence",
    description:
      "Tracks how your best technicians approach jobs — which steps they take, what order, what they check. Surfaces best practices and flags inefficiencies.",
  },
  {
    icon: Brain,
    title: "Diagnostic Learning Loop",
    description:
      "Learns from real repair outcomes to improve future recommendations. The more your team uses it, the smarter the diagnostics become.",
  },
];

export function AIIntelligenceSection() {
  return (
    <section id="ai-platform" className="landing-section-dark py-16 md:py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <p className="landing-eyebrow text-zinc-500 mb-4">Beyond the Basics</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15] mb-4">
            An AI platform that learns from every job
          </h2>
          <p className="text-lg text-zinc-400 leading-relaxed">
            FieldTek isn't just a checklist tool. It's an intelligence layer that gets smarter
            with every technician interaction, every repair, and every document you upload.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {capabilities.map((cap, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.1 }}
              className="rounded-xl bg-[#18181B] border border-zinc-800 p-8 hover:border-zinc-700 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center mb-4">
                <cap.icon className="h-5 w-5 text-orange-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{cap.title}</h3>
              <p className="text-zinc-400 leading-relaxed">{cap.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
