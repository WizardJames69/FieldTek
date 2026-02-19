import { memo } from "react";
import { cn } from "@/lib/utils";
import { useReducedAnimations } from "@/hooks/useReducedAnimations";

interface GlowDividerProps {
  color?: "primary" | "accent" | "muted";
  pulse?: boolean;
  className?: string;
}

export const GlowDivider = memo(function GlowDivider({
  color = "primary",
  pulse = false,
  className,
}: GlowDividerProps) {
  const reducedMotion = useReducedAnimations();

  const colorMap = {
    primary: "var(--primary)",
    accent: "var(--accent)",
    muted: "var(--muted-foreground)",
  };

  const gradientColor = colorMap[color];

  return (
    <div
      className={cn(
        "relative w-full h-px my-0 overflow-visible",
        className
      )}
      aria-hidden="true"
    >
      {/* Main glowing line */}
      <div
        className={cn(
          "absolute inset-x-0 h-px",
          pulse && !reducedMotion && "glow-divider-pulse"
        )}
        style={{
          background: `linear-gradient(90deg, transparent 0%, hsl(${gradientColor} / 0.3) 20%, hsl(${gradientColor} / 0.6) 50%, hsl(${gradientColor} / 0.3) 80%, transparent 100%)`,
        }}
      />
      
      {/* Central glow point */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-8"
        style={{
          background: `radial-gradient(ellipse 100% 100% at 50% 50%, hsl(${gradientColor} / 0.2), transparent 70%)`,
        }}
      />
    </div>
  );
});

export default GlowDivider;
