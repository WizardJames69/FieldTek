import { memo } from "react";
import { motion } from "framer-motion";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { HeroProductShot } from "./HeroProductShot";
import { AnimatedGroup } from "@/components/ui/animated-group";

// ── Animated background paths — mobile only ──────────────────────

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    color:
      i % 3 === 0
        ? `rgba(255, 255, 255, ${0.03 + i * 0.005})`
        : `rgba(249, 115, 22, ${0.06 + i * 0.012})`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="w-full h-full" viewBox="0 0 696 316" fill="none">
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

export const HeroSection = memo(function HeroSection() {
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
