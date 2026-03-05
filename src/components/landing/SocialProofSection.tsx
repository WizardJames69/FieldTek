import { motion } from "framer-motion";
import { Quote } from "lucide-react";

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

export function SocialProofSection() {
  return (
    <section className="landing-section-light py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12"
        >
          <p className="landing-eyebrow text-zinc-400 mb-4">Trusted by Contractors</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900">
            What early users are saying
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.1 }}
              className="rounded-xl border border-zinc-200 bg-white p-6"
            >
              <Quote className="h-5 w-5 text-zinc-300 mb-4" />
              <p className="text-zinc-600 leading-relaxed mb-6">"{testimonial.quote}"</p>
              <div>
                <div className="font-semibold text-zinc-900 text-sm">{testimonial.name}</div>
                <div className="text-xs text-zinc-500">
                  {testimonial.title}, {testimonial.company}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
