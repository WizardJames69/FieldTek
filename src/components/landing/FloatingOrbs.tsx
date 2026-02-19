import { memo } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/useReducedAnimations";

interface FloatingOrbsProps {
  variant?: "primary" | "accent" | "mixed";
  count?: 1 | 2 | 3;
  intensity?: "subtle" | "medium" | "strong";
  className?: string;
}

const orbConfigs = {
  1: [{ size: "w-96 h-96", position: "top-1/4 left-1/4", delay: "0s" }],
  2: [
    { size: "w-80 h-80", position: "top-10 right-[10%]", delay: "0s" },
    { size: "w-64 h-64", position: "bottom-20 left-[5%]", delay: "2s" },
  ],
  3: [
    { size: "w-72 h-72", position: "top-20 right-[15%]", delay: "0s" },
    { size: "w-56 h-56", position: "bottom-10 left-[10%]", delay: "1.5s" },
    { size: "w-48 h-48", position: "top-1/2 left-1/3", delay: "3s" },
  ],
};

const intensityMap = {
  subtle: { primary: "0.06", accent: "0.05" },
  medium: { primary: "0.1", accent: "0.08" },
  strong: { primary: "0.15", accent: "0.12" },
};

export const FloatingOrbs = memo(function FloatingOrbs({
  variant = "mixed",
  count = 2,
  intensity = "medium",
  className,
}: FloatingOrbsProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const orbs = orbConfigs[count];
  const opacities = intensityMap[intensity];

  // Now visible on all screen sizes for consistency
  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none -z-10",
        className
      )}
      aria-hidden="true"
    >
      {orbs.map((orb, index) => {
        // Determine color based on variant
        const isPrimary =
          variant === "primary" ||
          (variant === "mixed" && index % 2 === 0);
        const color = isPrimary ? "primary" : "accent";
        const opacity = isPrimary ? opacities.primary : opacities.accent;

        return (
          <div
            key={index}
            className={cn(
              "absolute rounded-full blur-3xl gpu-accelerated",
              orb.size,
              orb.position,
              !prefersReducedMotion && "floating-orb"
            )}
            style={{
              background: `radial-gradient(circle, hsl(var(--${color}) / ${opacity}), transparent 70%)`,
              animationDelay: prefersReducedMotion ? undefined : orb.delay,
            }}
          />
        );
      })}
    </div>
  );
});

export default FloatingOrbs;
