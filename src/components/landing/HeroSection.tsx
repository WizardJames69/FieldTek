import { memo } from "react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { HeroProductShot } from "./HeroProductShot";
import { AnimatedGroup } from "@/components/ui/animated-group";
import { Button } from "@/components/ui/button";

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
    <section className="landing-section-dark landing-hero-glow relative overflow-hidden">
      {/* Static background curves — mobile only */}
      <style>{`
        @keyframes subtle-drift {
          0% { transform: translateX(0px) translateY(0px); }
          50% { transform: translateX(8px) translateY(-5px); }
          100% { transform: translateX(0px) translateY(0px); }
        }
      `}</style>
      <div className="absolute inset-0 pointer-events-none overflow-hidden md:hidden">
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ animation: "subtle-drift 20s ease-in-out infinite" }}
          viewBox="0 0 400 800"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          {/* Upper curves — behind the headline */}
          <path d="M-50 200 Q200 100 450 250" stroke="#f97316" strokeWidth="0.8" strokeOpacity="0.12" />
          <path d="M-30 230 Q180 130 430 280" stroke="#f97316" strokeWidth="0.6" strokeOpacity="0.08" />
          <path d="M-70 170 Q220 70 470 220" stroke="#f97316" strokeWidth="1.0" strokeOpacity="0.06" />
          {/* Mid curves — behind subtitle and CTA area */}
          <path d="M-100 400 Q150 300 450 420" stroke="#f97316" strokeWidth="1.2" strokeOpacity="0.10" />
          <path d="M-80 430 Q170 330 470 450" stroke="#f97316" strokeWidth="0.7" strokeOpacity="0.07" />
          <path d="M-120 370 Q130 270 430 390" stroke="#f97316" strokeWidth="0.9" strokeOpacity="0.09" />
          {/* Lower sweeping curves */}
          <path d="M-50 550 Q200 480 450 600" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.12" />
          <path d="M-30 580 Q220 510 470 630" stroke="#f97316" strokeWidth="0.8" strokeOpacity="0.08" />
          <path d="M-80 520 Q180 450 430 570" stroke="#f97316" strokeWidth="1.0" strokeOpacity="0.06" />
          {/* Wide sweeping accent curves */}
          <path d="M-100 100 Q200 400 450 700" stroke="#f97316" strokeWidth="1.2" strokeOpacity="0.05" />
          <path d="M450 50 Q200 350 -50 650" stroke="#f97316" strokeWidth="1.0" strokeOpacity="0.04" />
          {/* Subtle gray curves for depth */}
          <path d="M-60 300 Q190 200 440 350" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.03" />
          <path d="M-40 500 Q210 430 460 550" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.02" />
        </svg>
      </div>

      <ContainerScroll
        titleComponent={
          <div className="max-w-4xl mx-auto pt-20 pb-10 md:pt-32 md:pb-0 lg:pt-40 text-center md:text-left">
            <AnimatedGroup variants={heroVariants}>
              {/* Announcement pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 mb-5 md:mb-7">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                <span className="text-xs font-medium tracking-wide text-zinc-400">
                  Private beta · Now building with design partners
                </span>
              </div>

              {/* H1 */}
              <h1 className="text-[clamp(2.25rem,5vw+1rem,5rem)] md:text-7xl lg:text-[80px] font-semibold tracking-[-0.03em] text-white leading-[1.05] mb-5 md:mb-6 text-balance">
                Guide Every Repair.
                <br />
                <span className="text-orange-500">Learn From Every Job.</span>
              </h1>

              {/* Subtitle — short scannable line on mobile, full sentence on desktop */}
              <p className="text-base md:text-xl text-[#9CA3AF] max-w-[400px] md:max-w-[540px] mx-auto md:mx-0 mb-8 md:mb-14 leading-relaxed">
                <span className="md:hidden">
                  Answers from your own manuals, equipment records, and job history. Citations your techs can check.
                </span>
                <span className="hidden md:inline">
                  FieldTek gives service teams answers from their own manuals, equipment records, and job history, with citations techs can check.
                </span>
              </p>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center md:justify-start gap-3 max-w-xs sm:max-w-none mx-auto md:mx-0">
                <Button variant="cool" size="lg" onClick={onApply}>
                  Apply for Beta Access
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-white/15 bg-transparent text-zinc-200 hover:bg-white/10 hover:text-white"
                >
                  <a href="#features">See How It Works</a>
                </Button>
              </div>

              {/* Mobile microcopy */}
              <p className="mt-4 text-xs text-zinc-500 md:hidden">
                Built with design partners before public launch.
              </p>

              {/* Entity definition for SEO/AEO/GEO — screen-reader and crawler accessible */}
              <p className="sr-only">
                FieldTek is an AI-powered field service management platform built for HVAC, electrical, plumbing, and mechanical contractors. The platform features Sentinel AI, an assistant that answers technician questions from uploaded manufacturer manuals with page-level citations and abstains rather than guessing when the documentation does not cover a question. FieldTek includes step-by-step job records with photo evidence, scheduling and dispatch, invoicing, a customer portal, and an offline-capable mobile app. Real-time compliance alerts, auto-generated service reports, and reviewed learning loops are in development with design partners.
              </p>
            </AnimatedGroup>
          </div>
        }
      >
        <HeroProductShot />
      </ContainerScroll>

      {/* Bottom gradient: dark to dark transition */}
      <div className="h-8 md:h-32 bg-gradient-to-b from-[#09090B] to-[#0C0D0F]" />
    </section>
  );
});
