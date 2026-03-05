import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { memo } from "react";
import { motion } from "framer-motion";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { WaitlistCounter } from "./WaitlistCounter";
import { HeroProductShot } from "./HeroProductShot";

interface HeroSectionProps {
  onJoinWaitlist?: () => void;
}

export const HeroSection = memo(function HeroSection({ onJoinWaitlist }: HeroSectionProps) {
  return (
    <section className="landing-section-dark landing-hero-glow relative overflow-hidden">
      <ContainerScroll
        titleComponent={
          <div className="max-w-4xl mx-auto">
            {/* Eyebrow */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="landing-eyebrow text-zinc-400 mb-6"
            >
              AI-Powered Field Service Platform
            </motion.p>

            {/* H1 */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.08 }}
              className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1] mb-6"
            >
              Guide Every Install.
              <br />
              <span className="text-orange-500">Protect Every Warranty.</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.16 }}
              className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              FieldTek's AI walks your techs through manufacturer specs, auto-documents every step,
              and keeps warranties intact — so you stop chasing callbacks.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.24 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Button
                asChild
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6 border-0 hover:shadow-[0_0_20px_rgba(249,115,22,0.2)] transition-shadow"
              >
                <Link to="/auth">
                  Get Early Access
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-lg px-8 py-6 border-zinc-700 text-zinc-300 hover:text-white hover:bg-white/5 hover:border-zinc-600"
                onClick={onJoinWaitlist}
              >
                Join Waitlist
              </Button>
            </motion.div>

            {/* Trust line */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.32 }}
              className="mt-5 text-sm text-zinc-500"
            >
              No credit card required. Setup in under 10 minutes.
            </motion.div>

            {/* Waitlist counter */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="flex justify-center mt-6 mb-4"
            >
              <WaitlistCounter />
            </motion.div>
          </div>
        }
      >
        <HeroProductShot />
      </ContainerScroll>

      {/* Bottom gradient: dark to light transition */}
      <div className="h-32 bg-gradient-to-b from-[#09090B] to-[#0C0D0F]" />
    </section>
  );
});
