import { motion } from "framer-motion";

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
    <section className="bg-[#111214] py-20 md:py-28 lg:py-32">
      <div className="mx-auto max-w-5xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12 md:mb-16"
        >
          <p className="landing-eyebrow text-zinc-500 mb-4">Trusted by Contractors</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white">
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
              className={`rounded-xl border border-white/[0.06] bg-[#161819] p-8 border-l-2 border-l-orange-500 hover:border-white/[0.12] hover:border-l-orange-500 transition-all duration-300 ${
                i === 0 ? "md:col-span-2" : ""
              }`}
            >
              <p className="text-lg text-zinc-300 leading-relaxed mb-6">"{testimonial.quote}"</p>
              <div>
                <div className="font-semibold text-white text-sm">{testimonial.name}</div>
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
