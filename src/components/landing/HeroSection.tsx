import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { memo, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { WaitlistCounter } from "./WaitlistCounter";
import { HeroProductShot } from "./HeroProductShot";
import { usePrefersReducedMotion } from "@/hooks/useReducedAnimations";
import { useIsMobile } from "@/hooks/use-mobile";

const industries = ["HVAC", "Plumbing", "Electrical", "Mechanical", "Elevator", "Home Automation", "General Contracting"];

interface HeroSectionProps {
  onJoinWaitlist?: () => void;
  onApplyBeta?: () => void;
}

export const HeroSection = memo(function HeroSection({ onJoinWaitlist, onApplyBeta }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"]
  });

  // Reduced parallax on mobile for performance, disabled for accessibility
  const parallaxMultiplier = prefersReducedMotion ? 0 : (isMobile ? 0.3 : 1);
  
  const y1 = useTransform(scrollYProgress, [0, 1], [0, 80 * parallaxMultiplier]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -40 * parallaxMultiplier]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, 30 * parallaxMultiplier]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5 pt-8 pb-16 aurora-bg noise-overlay">
      {/* Grid pattern background */}
      <div className="absolute inset-0 grid-pattern -z-10" />
      {/* Parallax background - all screen sizes with reduced intensity on mobile */}
      <div className="absolute inset-0 -z-10">
        <motion.div 
          style={{ y: y1, opacity }}
          className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" 
        />
        <motion.div 
          style={{ y: y2, opacity }}
          className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" 
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <motion.div 
        style={{ y: textY }}
        className="container mx-auto px-4"
      >
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div 
            initial={prefersReducedMotion ? false : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Now in Beta — Limited Spots
          </motion.div>

          {/* Main heading with gradient accent */}
          <motion.h1 
            initial={prefersReducedMotion ? false : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-4 leading-[1.15]"
          >
            Guide Every Install.
            <span className="block text-gradient-animate pb-1">Protect Every Warranty.</span>
          </motion.h1>

          {/* Concise value proposition */}
          <motion.p 
            initial={prefersReducedMotion ? false : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.12 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Stop chasing callbacks. FieldTek's AI walks your techs through manufacturer specs, auto-documents every step, and keeps warranties intact.
          </motion.p>

          {/* CTAs */}
          <motion.div 
            initial={prefersReducedMotion ? false : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button asChild variant="glow" size="lg" className="text-lg px-8 py-6">
              <Link to="/demo-sandbox">
                Start Free Demo
                <Play className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="text-lg px-8 py-6"
              onClick={onJoinWaitlist}
            >
              Join Waitlist — 50% Off for Beta
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>

          {/* Trust micro-copy */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.18 }}
            className="mt-4 space-y-2"
          >
            <p className="text-sm text-muted-foreground">
              No credit card required. See results in 2 minutes.
            </p>
            <button
              onClick={() => {
                document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-sm text-primary hover:text-primary/80 underline underline-offset-4 transition-colors"
            >
              Or watch a 2-min walkthrough ↓
            </button>
          </motion.div>

          {/* Waitlist Counter - Social Proof */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.22 }}
            className="flex justify-center mt-6"
          >
            <WaitlistCounter />
          </motion.div>

          {/* Product Shot */}
          <HeroProductShot />

          {/* Industry badges */}
          <motion.div 
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="mt-8 md:mt-12 pt-8 md:pt-12 border-t border-border/50"
          >
            <p className="text-sm text-muted-foreground mb-6">Built for skilled trade contractors</p>
            <div className="flex flex-wrap justify-center gap-3">
              {industries.map((industry) => (
                <span 
                  key={industry}
                  className="px-4 py-2 bg-muted/50 text-muted-foreground text-sm font-medium rounded-full border border-border/50"
                >
                  {industry}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
});

