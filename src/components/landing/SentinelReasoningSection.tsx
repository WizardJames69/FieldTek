import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";

// ── Pipeline Illustration ──────────────────────────────────────

const pipelineStyles = `
  @keyframes pipelineDot {
    0% { offset-distance: 0%; opacity: 0; }
    8% { opacity: 1; }
    92% { opacity: 1; }
    100% { offset-distance: 100%; opacity: 0; }
  }
  @keyframes pipelineNodeGlow {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pipeline-animate * { animation: none !important; }
  }
`;

const pipelineStages = [
  { label: "Technician\nQuestion", y: 28 },
  { label: "Manual\nRetrieval", y: 76 },
  { label: "Diagnostic\nGraph", y: 124 },
  { label: "Workflow\nStatistics", y: 172 },
  { label: "Pattern\nAdvisory", y: 220 },
  { label: "Context\nFusion", y: 268 },
  { label: "Ranked\nHypotheses", y: 328 },
];

function SentinelPipelineIllustration() {
  const cx = 170;

  return (
    <svg viewBox="0 0 340 370" className="w-full h-full pipeline-animate" fill="none">
      <style>{pipelineStyles}</style>

      {/* Vertical connecting line */}
      <line
        x1={cx}
        y1={pipelineStages[0].y + 18}
        x2={cx}
        y2={pipelineStages[pipelineStages.length - 1].y - 18}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />

      {/* Traveling dots between stages */}
      {pipelineStages.slice(0, -1).map((stage, i) => {
        const next = pipelineStages[i + 1];
        const segPath = `M${cx},${stage.y + 18} L${cx},${next.y - 18}`;
        return (
          <circle
            key={`dot-${i}`}
            r="3"
            fill="#f97316"
            opacity="0.7"
            style={{
              offsetPath: `path('${segPath}')`,
              animation: `pipelineDot 2s ease-in-out infinite ${i * 0.35}s`,
            }}
          />
        );
      })}

      {/* Stage nodes */}
      {pipelineStages.map((stage, i) => {
        const isFirst = i === 0;
        const isLast = i === pipelineStages.length - 1;
        const isFusion = stage.label.includes("Fusion");

        return (
          <g
            key={i}
            style={{
              animation: `pipelineNodeGlow ${3 + i * 0.2}s ease-in-out infinite`,
            }}
          >
            {/* Glow behind Context Fusion and Ranked Hypotheses */}
            {(isFusion || isLast) && (
              <circle
                cx={cx}
                cy={stage.y}
                r="38"
                fill="#f97316"
                opacity={isLast ? "0.04" : "0.03"}
              />
            )}

            {/* Node box */}
            <rect
              x={cx - 62}
              y={stage.y - 16}
              width="124"
              height="32"
              rx="7"
              fill={isLast ? "#1a1412" : "#161819"}
              stroke={
                isFirst
                  ? "rgba(255,255,255,0.12)"
                  : isFusion
                    ? "rgba(249,115,22,0.35)"
                    : isLast
                      ? "rgba(249,115,22,0.45)"
                      : "rgba(255,255,255,0.06)"
              }
              strokeWidth={isLast ? 2 : 1}
            />

            {/* Label */}
            {stage.label.split("\n").map((line, li) => (
              <text
                key={li}
                x={cx}
                y={stage.y + (li === 0 ? -2 : 10)}
                textAnchor="middle"
                fill={
                  isLast
                    ? "rgba(249,115,22,0.9)"
                    : isFusion
                      ? "rgba(249,115,22,0.7)"
                      : "rgba(255,255,255,0.45)"
                }
                fontSize="10"
                fontFamily="system-ui, sans-serif"
                fontWeight={isLast ? "600" : "400"}
              >
                {line}
              </text>
            ))}

            {/* Arrow indicator between nodes */}
            {i < pipelineStages.length - 1 && (
              <polygon
                points={`${cx - 3},${stage.y + 20} ${cx + 3},${stage.y + 20} ${cx},${stage.y + 24}`}
                fill="rgba(255,255,255,0.08)"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Section ────────────────────────────────────────────────────

export function SentinelReasoningSection() {
  return (
    <section className="bg-[#111214] py-20 md:py-28">
      {/* Gradient divider at top */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent -mt-20 md:-mt-28 mb-20 md:mb-28" />

      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Text (mobile: first, desktop: right) */}
          <div>
            <AnimatedEyebrow label="How Sentinel Reasons" colorClass="text-orange-500" className="mb-3" />
            <ScrollReveal delay={0.05}>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-tight mb-4">
                Sentinel doesn't guess. It cross-references everything.
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="text-zinc-400 leading-relaxed mb-6">
                When a technician asks Sentinel for help, it doesn't just search manuals. It pulls from
                equipment documentation, diagnostic history, workflow success rates, and discovered repair
                patterns, then ranks the most likely solutions by confidence.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.15}>
              <div className="space-y-3">
                {[
                  { source: "Equipment manuals", detail: "exact procedures from uploaded documentation" },
                  { source: "Repair history", detail: "what worked on this equipment before" },
                  { source: "Workflow outcomes", detail: "per-step success rates from completed jobs" },
                  { source: "Discovered patterns", detail: "recurring repair sequences across your fleet" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded bg-orange-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    </div>
                    <p className="text-sm text-zinc-400">
                      <span className="text-white font-medium">{item.source}</span>: {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>

          {/* Pipeline Illustration (mobile: second, desktop: left) */}
          <ScrollReveal delay={0.1} className="lg:order-first">
            <div className="w-full max-w-[440px] mx-auto aspect-[340/370]">
              <SentinelPipelineIllustration />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
