import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MetalButton } from "@/components/ui/metal-button";
import { LiquidButton } from "@/components/ui/liquid-button";

interface CTASectionProps {
  onJoinWaitlist?: () => void;
}

export function CTASection({ onJoinWaitlist }: CTASectionProps) {
  return (
    <section className="landing-section-dark py-16 md:py-20 lg:py-28">
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
            <Link to="/register">
              <MetalButton
                variant="fieldtek"
                size="lg"
                className="w-full sm:w-auto min-h-[48px] text-base sm:text-lg px-6 sm:px-8"
              >
                Get Early Access
                <ArrowRight className="ml-2 h-5 w-5" />
              </MetalButton>
            </Link>
            <LiquidButton
              size="lg"
              className="w-full sm:w-auto min-h-[48px] text-base sm:text-lg px-6 sm:px-8"
              onClick={onJoinWaitlist}
            >
              Join Waitlist
            </LiquidButton>
          </div>

          <p className="text-sm text-zinc-500">
            No credit card required. Setup in under 10 minutes.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
