import { memo } from "react";
import { motion } from "framer-motion";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { HeroProductShot } from "./HeroProductShot";
import { AnimatedGroup } from "@/components/ui/animated-group";
import { Button } from "@/components/ui/button";

// ── Animated background paths — mobile only ──────────────────────

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${300 + i * 8}C-${
      380 - i * 5 * position
    } -${300 + i * 8} -${312 - i * 5 * position} ${100 - i * 6} ${
      152 - i * 5 * position
    } ${300 - i * 6}C${616 - i * 5 * position} ${500 - i * 6} ${
      684 - i * 5 * position
    } ${800 - i * 6} ${684 - i * 5 * position} ${800 - i * 6}`,
    color:
      i % 3 === 0
        ? `rgba(255, 255, 255, ${0.06 + i * 0.01})`
        : `rgba(249, 115, 22, ${0.1 + i * 0.02})`,
    width: 0.8 + i * 0.15,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="w-full h-full" viewBox="0 0 696 800" preserveAspectRatio="xMidYMid slice" fill="none">
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke={path.color}
            strokeWidth={path.width}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.3, 0.6, 0.3],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  );
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

interface HeroSectionProps {
  onApply?: () => void;
}

export const HeroSection = memo(function HeroSection({ onApply }: HeroSectionProps) {
  return (
    <section className="landing-section-dark landing-hero-glow relative overflow-hidden min-h-[80svh] md:min-h-0">
      {/* Animated background paths — mobile only */}
      <div className="md:hidden absolute inset-0 z-0">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>

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

              {/* CTA buttons */}
              <div className="flex flex-wrap gap-3">
                <Button variant="cool" size="lg" onClick={onApply}>
                  Apply for Beta Access
                </Button>
                <Button asChild variant="ghost" size="lg" className="text-zinc-400 hover:text-white hover:bg-white/10">
                  <a href="#features">See How It Works</a>
                </Button>
              </div>

              {/* Entity definition for SEO/AEO/GEO — screen-reader and crawler accessible */}
              <p className="sr-only">
                FieldTek is an AI-powered field service management platform built for HVAC, electrical, plumbing, and mechanical contractors. The platform features Sentinel AI, a proprietary compliance and diagnostic engine that guides technicians through manufacturer-specific procedures, automatically generates compliance documentation, and protects warranties by verifying work against OEM specifications in real-time.
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
