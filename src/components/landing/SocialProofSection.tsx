import { motion } from "framer-motion";
import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";

const testimonials = [
  {
    quote:
      "We cut callbacks by 40% in the first month. The AI assistant answers questions that used to require a call back to the office.",
    name: "Mike Torres",
    title: "Operations Manager",
    company: "Precision HVAC Services",
  },
  {
    quote:
      "Our new hires are productive in days instead of weeks. The guided checklists mean they follow the manufacturer spec every time.",
    name: "Sarah Chen",
    title: "Service Director",
    company: "Summit Mechanical",
  },
  {
    quote:
      "Finally — documentation that doesn't rely on my techs remembering to fill out paperwork. The compliance reports generate themselves.",
    name: "David Ruiz",
    title: "Owner",
    company: "Elite Plumbing & Heating",
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
          <AnimatedEyebrow label="Trusted by Contractors" center />
          <ScrollReveal delay={0.05}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white">
              What early users are saying
            </h2>
          </ScrollReveal>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-stretch"
        >
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              variants={staggerItem}
              className="rounded-xl bg-[#161819] p-6 md:p-8 relative overflow-hidden hover:bg-[#1a1c1d] transition-colors duration-300 flex flex-col card-hover-lift"
            >
              {/* Gradient left accent */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[2px]"
                style={{ background: 'linear-gradient(to bottom, #F97316, transparent 70%)' }}
              />
              <p className="text-lg md:text-xl text-[#D1D5DB] leading-[1.6] mb-6 flex-1">"{testimonial.quote}"</p>
              <div>
                <div className="text-base font-semibold text-white">{testimonial.name}</div>
                <div className="text-sm text-[#6B7280]">
                  {testimonial.title}, {testimonial.company}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
