import { memo } from "react";
import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";
import { IsometricFeatures } from "./IsometricFeatures";

export const FeaturesSection = memo(function FeaturesSection() {
  return (
    <section id="features" className="bg-[#111214] py-6 md:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <AnimatedEyebrow label="The Solution" center />
          <ScrollReveal delay={0.05}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15]">
              Three pillars of reliable field service
            </h2>
          </ScrollReveal>
        </div>

        <ScrollReveal delay={0.1}>
          <div className="rounded-2xl border border-white/[0.04] bg-[#161819] py-8 md:py-10">
            <IsometricFeatures />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
});
