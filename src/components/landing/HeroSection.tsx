import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { memo } from "react";
import { motion } from "framer-motion";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { HeroProductShot } from "./HeroProductShot";

interface HeroSectionProps {
  onJoinWaitlist?: () => void;
}

export const HeroSection = memo(function HeroSection({ onJoinWaitlist }: HeroSectionProps) {
  return (
    <section className="landing-section-dark landing-hero-glow relative overflow-hidden">
      <ContainerScroll
        titleComponent={
          <div className="max-w-4xl mx-auto pt-20 md:pt-32 lg:pt-40">
            {/* H1 */}
            <motion.h1
              initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="text-[clamp(2.25rem,5vw+1rem,5rem)] md:text-7xl lg:text-[80px] font-semibold tracking-[-0.03em] text-white leading-[1.05] mb-6"
            >
              Guide Every Install.
              <br />
              <span className="text-orange-500">Protect Every Warranty.</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="text-lg md:text-xl text-[#9CA3AF] max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              AI-guided installs. Automatic documentation. Warranty compliance — built in.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mb-8 md:mb-16"
            >
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
            </motion.div>
          </div>
        }
      >
        <HeroProductShot />
      </ContainerScroll>

      {/* Bottom gradient: dark to dark transition */}
      <div className="h-32 bg-gradient-to-b from-[#09090B] to-[#0C0D0F]" />
    </section>
  );
});
