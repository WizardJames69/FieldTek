import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";
import { CheckCircle2 } from "lucide-react";

// ── Loop Illustration ──────────────────────────────────────────

const loopSteps = [
  { label: "Job\nCompleted", x: 170, y: 42 },
  { label: "Outcome\nRecorded", x: 296, y: 106 },
  { label: "Statistics\nComputed", x: 296, y: 214 },
  { label: "Patterns\nDiscovered", x: 170, y: 278 },
  { label: "Better\nGuidance", x: 44, y: 214 },
  { label: "Next\nJob", x: 44, y: 106 },
];

// Node visual hierarchy by role
const loopNodeStyle = [
  { fill: "#161618", stroke: "rgba(249,115,22,0.4)", sw: 1.5, text: "#e4e4e7" },   // Job Completed — entry
  { fill: "#161618", stroke: "#1e1e22", sw: 1, text: "#a1a1a6" },                   // Outcome Recorded — processing
  { fill: "#161618", stroke: "#1e1e22", sw: 1, text: "#a1a1a6" },                   // Statistics Computed — processing
  { fill: "#1a1a1d", stroke: "#222225", sw: 1, text: "#b4b4b9" },                   // Patterns Discovered — intelligence
  { fill: "#1a1a1d", stroke: "#222225", sw: 1, text: "#b4b4b9" },                   // Better Guidance — intelligence
  { fill: "#161618", stroke: "#1e1e22", sw: 1, text: "#a1a1a6" },                   // Next Job — output
];

function IntelligenceLoopIllustration() {
  return (
    <svg viewBox="0 0 340 320" className="w-full h-full" fill="none">
      <defs>
        <filter id="loop-sh">
          <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="#000" floodOpacity="0.2" />
        </filter>
      </defs>

      {/* Connection lines — closed loop */}
      {loopSteps.map((step, i) => {
        const next = loopSteps[(i + 1) % loopSteps.length];
        const isLoopBack = i === loopSteps.length - 1;
        return (
          <line
            key={`conn-${i}`}
            x1={step.x} y1={step.y} x2={next.x} y2={next.y}
            stroke="#2a2a2e" strokeWidth="1.5"
            strokeDasharray={isLoopBack ? "6 4" : undefined}
          />
        );
      })}

      {/* Directional chevrons at segment midpoints */}
      {loopSteps.map((step, i) => {
        const next = loopSteps[(i + 1) % loopSteps.length];
        const mx = (step.x + next.x) / 2;
        const my = (step.y + next.y) / 2;
        const dx = next.x - step.x;
        const dy = next.y - step.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = dx / len, ny = dy / len;
        const px = -ny, py = nx; // perpendicular
        const s = 4; // chevron size
        return (
          <polygon
            key={`chev-${i}`}
            points={`${mx + nx * s},${my + ny * s} ${mx - nx * s + px * s},${my - ny * s + py * s} ${mx - nx * s - px * s},${my - ny * s - py * s}`}
            fill="#2a2a2e"
          />
        );
      })}

      {/* Nodes */}
      {loopSteps.map((step, i) => {
        const ns = loopNodeStyle[i];
        const hw = 42, hh = 18;
        return (
          <g key={i} filter="url(#loop-sh)">
            {/* Orange glow behind Job Completed */}
            {i === 0 && <circle cx={step.x} cy={step.y} r="36" fill="#f97316" opacity="0.06" />}

            <rect
              x={step.x - hw} y={step.y - hh}
              width={hw * 2} height={hh * 2}
              rx="6" fill={ns.fill} stroke={ns.stroke} strokeWidth={ns.sw}
            />

            {step.label.split("\n").map((line, li) => (
              <text
                key={li}
                x={step.x} y={step.y + (li === 0 ? -3 : 10)}
                textAnchor="middle" fill={ns.text}
                fontSize="11" fontFamily="system-ui, sans-serif"
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
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
          <ScrollReveal delay={0.1} className="hidden md:block">
            <div className="w-full max-w-[480px] mx-auto aspect-[340/320]">
              <IntelligenceLoopIllustration />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
