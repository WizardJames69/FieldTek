import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";

// ── Pipeline Illustration ──────────────────────────────────────

const pipelineStages = [
  { label: "Technician\nQuestion",  y: 24 },
  { label: "Manual\nRetrieval",     y: 68 },
  { label: "Diagnostic\nGraph",     y: 112 },
  { label: "Workflow\nStatistics",  y: 156 },
  { label: "Pattern\nAdvisory",     y: 200 },
  { label: "Context\nFusion",       y: 248 },
  { label: "Ranked\nHypotheses",    y: 310 },
];

// Progressive escalation: width, fill, border, text color
const pipelineNodeStyle = [
  { w: 106, fill: "#151517", stroke: "#1a1a1d", sw: 1,   text: "#909095", fw: "400" as const },
  { w: 110, fill: "#161618", stroke: "#1e1e22", sw: 1,   text: "#a1a1a6", fw: "400" as const },
  { w: 114, fill: "#161618", stroke: "#1e1e22", sw: 1,   text: "#a1a1a6", fw: "400" as const },
  { w: 118, fill: "#171719", stroke: "#202024", sw: 1,   text: "#a8a8ad", fw: "400" as const },
  { w: 122, fill: "#171719", stroke: "#222225", sw: 1,   text: "#a8a8ad", fw: "400" as const },
  { w: 128, fill: "#181a1c", stroke: "rgba(249,115,22,0.15)", sw: 1,   text: "#b8b8bd", fw: "400" as const },
  { w: 134, fill: "#1e1e22", stroke: "rgba(249,115,22,0.45)", sw: 1.5, text: "#e4e4e7", fw: "600" as const },
];

function SentinelPipelineIllustration() {
  const cx = 170;

  // Progressive connection line styles
  const connStyle = (i: number) => {
    if (i >= 5) return { stroke: "rgba(249,115,22,0.1)", sw: 1.5 };
    if (i >= 3) return { stroke: "rgba(255,255,255,0.06)", sw: 1.2 };
    return { stroke: "rgba(255,255,255,0.05)", sw: 1 };
  };

  return (
    <svg viewBox="0 0 340 350" className="w-full h-full" fill="none">
      <defs>
        <filter id="pipe-sh">
          <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="#000" floodOpacity="0.2" />
        </filter>
      </defs>

      {/* Connection lines + chevrons between nodes */}
      {pipelineStages.slice(0, -1).map((stage, i) => {
        const next = pipelineStages[i + 1];
        const y1 = stage.y + 16; // bottom of current node
        const y2 = next.y - 16;  // top of next node
        const cs = connStyle(i);
        const my = (y1 + y2) / 2;
        return (
          <g key={`conn-${i}`}>
            <line x1={cx} y1={y1} x2={cx} y2={y2} stroke={cs.stroke} strokeWidth={cs.sw} />
            {/* Downward chevron */}
            <polygon
              points={`${cx - 3},${my - 2} ${cx + 3},${my - 2} ${cx},${my + 3}`}
              fill={cs.stroke}
            />
          </g>
        );
      })}

      {/* Stage nodes */}
      {pipelineStages.map((stage, i) => {
        const ns = pipelineNodeStyle[i];
        const isLast = i === pipelineStages.length - 1;
        const hw = ns.w / 2;
        return (
          <g key={i} filter="url(#pipe-sh)">
            {/* Orange glow behind Ranked Hypotheses */}
            {isLast && <circle cx={cx} cy={stage.y} r="40" fill="#f97316" opacity="0.04" />}

            <rect
              x={cx - hw} y={stage.y - 16}
              width={ns.w} height="32"
              rx="6" fill={ns.fill} stroke={ns.stroke} strokeWidth={ns.sw}
            />

            {stage.label.split("\n").map((line, li) => (
              <text
                key={li}
                x={cx} y={stage.y + (li === 0 ? -2 : 10)}
                textAnchor="middle" fill={ns.text}
                fontSize={isLast ? "12" : "11"}
                fontFamily="system-ui, sans-serif"
                fontWeight={ns.fw}
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

// ── Section ────────────────────────────────────────────────────

export function SentinelReasoningSection() {
  return (
    <section className="hidden md:block bg-[#111214] py-6 md:py-8 lg:py-10">
      {/* Gradient divider at top */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent -mt-6 md:-mt-8 lg:-mt-10 mb-6 md:mb-8 lg:mb-10" />

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
          <ScrollReveal delay={0.1} className="hidden md:block lg:order-first">
            <div className="w-full max-w-[440px] mx-auto aspect-[340/370]">
              <SentinelPipelineIllustration />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
