import { motion } from "framer-motion";
import { Building2, Cpu, Users, Shield } from "lucide-react";

const metrics = [
  { icon: Building2, value: "7", label: "Industries Served" },
  { icon: Cpu, value: "500+", label: "Equipment Models" },
  { icon: Users, value: "50+", label: "Beta Testers" },
  { icon: Shield, value: "99.9%", label: "Uptime" },
];

export function TrustBar() {
  return (
    <section className="landing-section-light py-12 border-b border-zinc-200">
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {metrics.map((metric, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.1 }}
              className="flex flex-col items-center text-center"
            >
              <metric.icon className="h-5 w-5 text-zinc-400 mb-2" />
              <div className="text-2xl font-bold text-zinc-900">{metric.value}</div>
              <div className="text-sm text-zinc-500">{metric.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
