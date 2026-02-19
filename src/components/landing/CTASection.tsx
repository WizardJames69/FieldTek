import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef } from "react";
import { FloatingElement, ScrollReveal } from "./ParallaxSection";

const benefits = [
  "Early access for waitlist members",
  "Free onboarding and training",
  "Priority support during beta"
];

interface CTASectionProps {
  onJoinWaitlist?: () => void;
}

export function CTASection({ onJoinWaitlist }: CTASectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const backgroundY = useTransform(smoothProgress, [0, 1], [100, -100]);
  const contentScale = useTransform(smoothProgress, [0, 0.5, 1], [0.95, 1, 0.98]);

  return (
    <section ref={sectionRef} className="relative py-16 bg-primary text-primary-foreground overflow-hidden">
      {/* Parallax background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div style={{ y: backgroundY }} className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        </motion.div>
        
        <FloatingElement delay={0} duration={8} distance={20} className="absolute top-10 left-[10%]">
          <div className="w-32 h-32 bg-white/5 rounded-full blur-xl" />
        </FloatingElement>
        <FloatingElement delay={2} duration={6} distance={15} className="absolute bottom-20 right-[15%]">
          <div className="w-24 h-24 bg-white/10 rounded-xl rotate-45 blur-lg" />
        </FloatingElement>
        <FloatingElement delay={4} duration={10} distance={25} className="absolute top-1/3 right-[5%]">
          <div className="w-16 h-16 bg-white/5 rounded-full blur-lg" />
        </FloatingElement>
      </div>

      <motion.div style={{ scale: contentScale }} className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <ScrollReveal direction="up">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Transform Your Operations?
            </h2>
          </ScrollReveal>
          
          <ScrollReveal direction="up" delay={0.1}>
            <p className="text-lg text-primary-foreground/80 mb-8">
              See how FieldTek can streamline your field service business with a personalized demo.
            </p>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.2}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  asChild 
                  size="lg" 
                  variant="secondary"
                  className="text-lg px-8 py-6 btn-3d"
                >
                  <Link to="/demo-sandbox">
                    Try Interactive Demo
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-8 py-6 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                  onClick={onJoinWaitlist}
                >
                  Join Waitlist
                </Button>
              </motion.div>
            </div>
            <p className="text-sm text-primary-foreground/70 mb-8">
              Need personalized guidance?{" "}
              <a href="/consultation" className="underline hover:text-primary-foreground transition-colors">
                Schedule a consultation
              </a>{" "}
              with our team.
            </p>
          </ScrollReveal>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-wrap justify-center gap-6"
          >
            {benefits.map((benefit, index) => (
              <motion.div 
                key={index} 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="flex items-center gap-2 text-primary-foreground/80"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">{benefit}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
