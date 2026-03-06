import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface CTASectionProps {
  onJoinWaitlist?: () => void;
}

export function CTASection({ onJoinWaitlist }: CTASectionProps) {
  return (
    <section className="landing-section-dark py-16 md:py-24 lg:py-32">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15] mb-4">
            Ready to eliminate callbacks?
          </h2>
          <p className="text-lg text-zinc-400 mb-10 max-w-2xl mx-auto">
            Join the contractors who are using AI to guide installs, protect warranties,
            and build documentation that holds up to any inspection.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mb-6">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto min-h-[48px] bg-orange-500 hover:bg-orange-600 text-white text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-6 border-0 cta-glow"
            >
              <Link to="/auth">
                Get Early Access
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto min-h-[48px] text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-6 bg-transparent border border-white/25 text-white hover:border-white/50 hover:bg-white/5 transition-all duration-300"
              onClick={onJoinWaitlist}
            >
              Join Waitlist
            </Button>
          </div>

          <p className="text-sm text-zinc-500">
            No credit card required. Setup in under 10 minutes.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
