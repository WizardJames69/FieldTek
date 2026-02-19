import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FlaskConical, MessageSquare, Sparkles, Award, Lock } from "lucide-react";

interface BetaTesterSectionProps {
  onApply: () => void;
}

const benefits = [
  {
    icon: MessageSquare,
    text: "Direct line to product team",
  },
  {
    icon: Sparkles,
    text: "Priority feature requests",
  },
  {
    icon: FlaskConical,
    text: "Shape the roadmap",
  },
  {
    icon: Award,
    text: '"Founding Member" badge',
  },
];

export function BetaTesterSection({ onApply }: BetaTesterSectionProps) {
  return (
    <section id="beta-program" className="relative py-20 overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-60" />
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <FlaskConical className="h-4 w-4" />
              Beta Program
            </div>

            {/* Headline */}
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Join Our Beta Program
            </h2>

            {/* Value Proposition */}
            <p className="text-lg text-muted-foreground mb-2">
              Help shape FieldTek and lock in
            </p>
            
            {/* Discount Badge */}
            <motion.div
              initial={{ scale: 0.9 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", delay: 0.2 }}
              className="inline-block mb-8"
            >
              <div className="relative">
                <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-6 py-3 rounded-xl text-2xl md:text-3xl font-bold shadow-lg shadow-primary/25">
                  50% OFF
                </div>
                <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-xs font-semibold px-2 py-1 rounded-full">
                  1st Year
                </span>
              </div>
            </motion.div>

            <p className="text-muted-foreground mb-8">
              your first year subscription after launch
            </p>

            {/* Benefits Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.text}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + index * 0.1 }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <benefit.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm text-foreground text-center font-medium">
                    {benefit.text}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center gap-4"
            >
              <Button
                size="lg"
                onClick={onApply}
                className="btn-3d text-base px-8 py-6 h-auto"
              >
                <FlaskConical className="mr-2 h-5 w-5" />
                Apply for Beta Access
              </Button>

              {/* Trust Signal */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>Limited to 10 companies</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
