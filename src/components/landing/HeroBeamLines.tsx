import { usePrefersReducedMotion } from "@/hooks/useReducedAnimations";

export function HeroBeamLines() {
  const prefersReducedMotion = usePrefersReducedMotion();

  // Don't render any animations if user prefers reduced motion (accessibility)
  if (prefersReducedMotion) {
    return null;
  }

  // Beam line configuration: width percentages and animation delays
  const beams = [
    { width: "80%", delay: "0s" },
    { width: "60%", delay: "0.5s" },
    { width: "40%", delay: "1s" },
    { width: "25%", delay: "1.5s" },
  ];

  return (
    <div className="relative mt-8" aria-hidden="true">
      {/* Central glow point */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 -top-4 w-24 h-8 rounded-full blur-xl"
        style={{
          background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.4) 0%, transparent 70%)"
        }}
      />
      
      {/* Beam lines container */}
      <div className="flex flex-col items-center gap-3">
        {beams.map((beam, index) => (
          <div
            key={index}
            className="beam-line rounded-full"
            style={{
              width: beam.width,
              animationDelay: beam.delay,
            }}
          />
        ))}
      </div>
      
      {/* Bottom fade glow */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 bottom-0 w-48 h-12 rounded-full blur-2xl opacity-30"
        style={{
          background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.3) 0%, transparent 70%)"
        }}
      />
    </div>
  );
}
