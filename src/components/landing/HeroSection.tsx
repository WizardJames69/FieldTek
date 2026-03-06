import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { memo } from "react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { HeroProductShot } from "./HeroProductShot";
import { AnimatedGroup } from "@/components/ui/animated-group";

interface HeroSectionProps {
  onJoinWaitlist?: () => void;
}

const heroVariants = {
  container: {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.3,
      },
    },
  },
  item: {
    hidden: { opacity: 0, filter: "blur(12px)", y: 16 },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        type: "spring" as const,
        bounce: 0.3,
        duration: 1.2,
      },
    },
  },
};

export const HeroSection = memo(function HeroSection({ onJoinWaitlist }: HeroSectionProps) {
  return (
    <section className="landing-section-dark landing-hero-glow relative overflow-hidden">
      <ContainerScroll
        titleComponent={
          <div className="max-w-4xl mx-auto pt-20 md:pt-32 lg:pt-40">
            <AnimatedGroup variants={heroVariants} className="text-center">
              {/* H1 */}
              <h1 className="text-[clamp(2.25rem,5vw+1rem,5rem)] md:text-7xl lg:text-[80px] font-semibold tracking-[-0.03em] text-white leading-[1.05] mb-6 text-balance">
                Guide Every Install.
                <br />
                <span className="text-orange-500">Protect Every Warranty.</span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg md:text-xl text-[#9CA3AF] max-w-2xl mx-auto mb-10 leading-relaxed">
                AI-guided installs. Automatic documentation. Warranty compliance — built in.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mb-8 md:mb-16">
                {/* Primary CTA — double-border glow container */}
                <div className="w-full sm:w-auto rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-0.5">
                  <Button
                    asChild
                    className="w-full sm:w-auto h-[44px] rounded-xl px-6 text-base bg-orange-500 hover:bg-orange-600 text-white cta-glow"
                  >
                    <Link to="/register">
                      Get Early Access
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </div>

                {/* Secondary CTA — clean ghost */}
                <Button
                  variant="ghost"
                  className="w-full sm:w-auto h-[44px] rounded-xl px-6 text-base text-white hover:bg-white/[0.06]"
                  onClick={onJoinWaitlist}
                >
                  Join Waitlist
                </Button>
              </div>
            </AnimatedGroup>
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
