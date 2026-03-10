import { memo } from "react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { HeroProductShot } from "./HeroProductShot";
import { AnimatedGroup } from "@/components/ui/animated-group";

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

export const HeroSection = memo(function HeroSection() {
  return (
    <section className="landing-section-dark landing-hero-glow relative overflow-hidden">
      <ContainerScroll
        titleComponent={
          <div className="max-w-4xl mx-auto pt-20 md:pt-32 lg:pt-40">
            <AnimatedGroup variants={heroVariants}>
              {/* H1 */}
              <h1 className="text-[clamp(2.25rem,5vw+1rem,5rem)] md:text-7xl lg:text-[80px] font-semibold tracking-[-0.03em] text-white leading-[1.05] mb-6 text-balance">
                Guide Every Repair.
                <br />
                <span className="text-orange-500">Learn From Every Job.</span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg md:text-xl text-[#9CA3AF] max-w-[540px] mb-6 md:mb-14 leading-relaxed">
                AI-guided diagnostics. Workflow enforcement. Automatic documentation. Compliance protection. All getting smarter with every repair.
              </p>
            </AnimatedGroup>
          </div>
        }
      >
        <HeroProductShot />
      </ContainerScroll>

      {/* Bottom gradient: dark to dark transition */}
      <div className="h-12 md:h-32 bg-gradient-to-b from-[#09090B] to-[#0C0D0F]" />
    </section>
  );
});
