import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";
import { CheckCircle2 } from "lucide-react";

// ── Loop Illustration ──────────────────────────────────────────

const loopStyles = `
  @keyframes loopDotTravel {
    0% { offset-distance: 0%; opacity: 0; }
    5% { opacity: 1; }
    95% { opacity: 1; }
    100% { offset-distance: 100%; opacity: 0; }
  }
  @keyframes loopNodePulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }
  @keyframes loopDataFlow {
    to { stroke-dashoffset: -120; }
  }
  @media (prefers-reduced-motion: reduce) {
    .loop-animate * { animation: none !important; }
  }
`;

const loopSteps = [
  { label: "Job\nCompleted", x: 170, y: 42 },
  { label: "Outcome\nRecorded", x: 296, y: 106 },
  { label: "Statistics\nComputed", x: 296, y: 214 },
  { label: "Patterns\nDiscovered", x: 170, y: 278 },
  { label: "Better\nGuidance", x: 44, y: 214 },
  { label: "Next\nJob", x: 44, y: 106 },
];

function IntelligenceLoopIllustration() {
  // Build a closed loop path through all nodes
  const pathPoints = loopSteps.map((s) => `${s.x},${s.y}`).join(" L");
  const closedPath = `M${pathPoints} L${loopSteps[0].x},${loopSteps[0].y}`;

  // Build individual segment paths for traveling dots
  const segments = loopSteps.map((s, i) => {
    const next = loopSteps[(i + 1) % loopSteps.length];
    return `M${s.x},${s.y} L${next.x},${next.y}`;
  });

  return (
    <svg viewBox="0 0 340 320" className="w-full h-full loop-animate" fill="none">
      <style>{loopStyles}</style>

      {/* Static connection lines */}
      <path
        d={closedPath}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1.5"
        fill="none"
      />

      {/* Flowing data pulse along the loop */}
      <path
        d={closedPath}
        stroke="rgba(249,115,22,0.12)"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="6 14"
        style={{ animation: "loopDataFlow 8s linear infinite" }}
      />

      {/* Traveling dots */}
      {segments.map((seg, i) => (
        <circle
          key={`dot-${i}`}
          r="3.5"
          fill="#f97316"
          opacity="0.8"
          style={{
            offsetPath: `path('${seg}')`,
            animation: `loopDotTravel 3s ease-in-out infinite ${i * 0.5}s`,
          }}
        />
      ))}

      {/* Nodes */}
      {loopSteps.map((step, i) => (
        <g key={i} style={{ animation: `loopNodePulse ${3 + i * 0.3}s ease-in-out infinite` }}>
          {/* Glow behind Job Completed node */}
          {i === 0 && (
            <circle
              cx={step.x}
              cy={step.y}
              r="36"
              fill="#f97316"
              opacity="0.04"
            />
          )}
          {/* Node background */}
          <rect
            x={step.x - 44}
            y={step.y - 20}
            width="88"
            height="40"
            rx="10"
            fill="#161819"
            stroke={i === 0 ? "rgba(249,115,22,0.45)" : "rgba(255,255,255,0.08)"}
            strokeWidth={i === 0 ? 1.5 : 1}
          />
          {/* Node label */}
          {step.label.split("\n").map((line, li) => (
            <text
              key={li}
              x={step.x}
              y={step.y + (li === 0 ? -4 : 10)}
              textAnchor="middle"
              fill={i === 0 ? "rgba(249,115,22,0.7)" : "rgba(255,255,255,0.4)"}
              fontSize="10"
              fontFamily="system-ui, sans-serif"
            >
              {line}
            </text>
          ))}
        </g>
      ))}
    </svg>
  );
}

// ── Supporting Points ──────────────────────────────────────────

const points = [
  {
    title: "Outcome Tracking",
    description: "Every repair result is recorded and analyzed.",
  },
  {
    title: "Success Statistics",
    description: "Per-step success rates reveal which approaches work best.",
  },
  {
    title: "Pattern Discovery",
    description: "AI detects repeating symptom-to-fix sequences across your jobs.",
  },
  {
    title: "Ranked Hypotheses",
    description: "Sentinel cross-references all signals to rank the most likely repair.",
  },
];

// ── Section ────────────────────────────────────────────────────

export function IntelligenceLoopSection() {
  return (
    <section className="bg-[#0C0D0F] py-6 md:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left: Text */}
          <div>
            <AnimatedEyebrow label="Self-Improving AI" colorClass="text-orange-500" className="mb-3" />
            <ScrollReveal delay={0.05}>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-tight mb-4">
                Intelligence that compounds with every repair
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="text-zinc-400 leading-relaxed mb-8">
                Most field service AI is static. It only knows what was programmed. FieldTek continuously
                improves because it learns from every completed job. Repair outcomes feed into diagnostic
                statistics, which reveal patterns, which improve the guidance your technicians receive next time.
              </p>
            </ScrollReveal>

            <div className="space-y-4">
              {points.map((point, i) => (
                <ScrollReveal key={i} delay={0.15 + i * 0.06}>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-orange-500 mt-1 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-semibold text-white">{point.title}</span>
                      <span className="text-sm text-zinc-400 ml-1">: {point.description}</span>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>

          {/* Right: Loop Illustration */}
          <ScrollReveal delay={0.1}>
            <div className="w-full max-w-[480px] mx-auto aspect-[340/320]">
              <IntelligenceLoopIllustration />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
