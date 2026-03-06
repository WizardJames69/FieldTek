import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";

const valueProps = [
  {
    number: "01",
    title: "Shape the product",
    description: "Your feedback directly influences what we build next.",
  },
  {
    number: "02",
    title: "Priority support",
    description: "Direct line to our engineering team during beta.",
  },
  {
    number: "03",
    title: "Founding member pricing",
    description: "Lock in early pricing that stays with you.",
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

export function SocialProofSection() {
  return (
    <section className="bg-[#111214] py-16 md:py-28 lg:py-32">
      <div className="mx-auto max-w-5xl px-4">
        <div className="text-center mb-12 md:mb-16">
          <AnimatedEyebrow label="Early Access" center />
          <ScrollReveal delay={0.05}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white">
              Help us build the future of field service
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto mt-4">
              We're partnering with contractors to shape FieldTek before public launch.
              Early access members get direct input on features, priority support, and founding member pricing.
            </p>
          </ScrollReveal>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-10"
        >
          {valueProps.map((prop) => (
            <motion.div
              key={prop.title}
              variants={staggerItem}
              className="text-center md:text-left"
            >
              <span className="text-2xl font-semibold text-orange-500 mb-3 block">
                {prop.number}
              </span>
              <h3 className="text-lg font-semibold text-white mb-1.5">{prop.title}</h3>
              <p className="text-[15px] text-[#9CA3AF] leading-relaxed">{prop.description}</p>
            </motion.div>
          ))}
        </motion.div>

        <ScrollReveal delay={0.15}>
          <div className="text-center">
            <Button
              asChild
              size="lg"
              className="bg-orange-500 hover:bg-orange-600 text-white border-0"
            >
              <Link to="/register">
                Apply for Early Access
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
