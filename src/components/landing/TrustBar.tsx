import { motion } from "framer-motion";

const metrics = [
  { value: "7", label: "Industries Served" },
  { value: "500+", label: "Equipment Models" },
  { value: "50+", label: "Contractors in Early Access" },
  { value: "99.9%", label: "Uptime" },
];

export function TrustBar() {
  return (
    <section className="bg-[#0C0D0F] py-12 border-y border-white/[0.06]">
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {metrics.map((metric, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.1 }}
              className="flex flex-col items-center text-center"
            >
              <div className="text-2xl md:text-4xl font-bold text-white">{metric.value}</div>
              <div className="text-sm text-zinc-500">{metric.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
