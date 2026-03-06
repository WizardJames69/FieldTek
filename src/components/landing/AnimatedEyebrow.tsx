import { motion } from "framer-motion";

interface AnimatedEyebrowProps {
  label: string;
  center?: boolean;
  colorClass?: string;
  className?: string;
}

export function AnimatedEyebrow({
  label,
  center = false,
  colorClass = "text-zinc-500",
  className = "",
}: AnimatedEyebrowProps) {
  return (
    <motion.div
      className={`flex items-center gap-3 ${center ? "justify-center" : ""} ${className || "mb-4"}`}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: 20 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="h-px bg-orange-500"
      />
      <span className={`landing-eyebrow ${colorClass}`}>{label}</span>
    </motion.div>
  );
}
