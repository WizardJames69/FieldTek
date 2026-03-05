/**
 * Ambient animated light dots on isometric blocks.
 * Pure CSS animations — no JS loops.
 * Inspired by Linear's FIG 0.3 cube illustration.
 */

const blocks = [
  { x: 60, y: 40, w: 80, h: 50, skew: -8 },
  { x: 170, y: 80, w: 90, h: 60, skew: -8 },
  { x: 30, y: 140, w: 70, h: 45, skew: -8 },
  { x: 140, y: 170, w: 100, h: 55, skew: -8 },
  { x: 260, y: 50, w: 75, h: 50, skew: -8 },
  { x: 240, y: 160, w: 85, h: 48, skew: -8 },
];

type DotColor = "orange" | "blue" | "amber";

interface Dot {
  x: number;
  y: number;
  color: DotColor;
  duration: string;
  delay: string;
  size: number;
}

const dots: Dot[] = [
  { x: 80, y: 55, color: "orange", duration: "3.2s", delay: "0s", size: 4 },
  { x: 120, y: 60, color: "orange", duration: "2.8s", delay: "0.7s", size: 3 },
  { x: 190, y: 95, color: "blue", duration: "4.1s", delay: "1.2s", size: 4 },
  { x: 220, y: 105, color: "orange", duration: "3.5s", delay: "0.3s", size: 3 },
  { x: 50, y: 155, color: "orange", duration: "2.5s", delay: "2.1s", size: 4 },
  { x: 75, y: 165, color: "amber", duration: "4.5s", delay: "0.8s", size: 3 },
  { x: 160, y: 185, color: "orange", duration: "3.0s", delay: "1.5s", size: 5 },
  { x: 200, y: 195, color: "blue", duration: "3.8s", delay: "3.2s", size: 3 },
  { x: 280, y: 65, color: "orange", duration: "2.9s", delay: "0.5s", size: 4 },
  { x: 310, y: 75, color: "orange", duration: "4.2s", delay: "2.4s", size: 3 },
  { x: 260, y: 175, color: "amber", duration: "3.6s", delay: "1.8s", size: 4 },
  { x: 295, y: 185, color: "orange", duration: "2.7s", delay: "3.8s", size: 3 },
  { x: 105, y: 50, color: "orange", duration: "4.0s", delay: "0.4s", size: 3 },
  { x: 175, y: 100, color: "orange", duration: "3.3s", delay: "2.9s", size: 4 },
  { x: 145, y: 195, color: "blue", duration: "3.7s", delay: "1.0s", size: 3 },
];

const dotColors: Record<DotColor, string> = {
  orange: "rgba(249, 115, 22, 0.8)",
  blue: "rgba(147, 197, 253, 0.5)",
  amber: "rgba(251, 191, 36, 0.5)",
};

export function IsometricLights() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-50 hidden md:block">
      <svg
        viewBox="0 0 400 260"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[400px] h-auto aspect-[400/260]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Isometric blocks */}
        {blocks.map((block, i) => (
          <rect
            key={`block-${i}`}
            x={block.x}
            y={block.y}
            width={block.w}
            height={block.h}
            rx={4}
            fill="#141516"
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth={1}
            transform={`skewY(${block.skew})`}
          />
        ))}

        {/* Pulsing light dots */}
        {dots.map((dot, i) => (
          <circle
            key={`dot-${i}`}
            cx={dot.x}
            cy={dot.y}
            r={dot.size / 2}
            fill={dotColors[dot.color]}
            className="light-dot"
            style={{
              "--duration": dot.duration,
              "--delay": dot.delay,
            } as React.CSSProperties}
          />
        ))}
      </svg>
    </div>
  );
}
