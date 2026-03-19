/**
 * Three animated isometric SVG illustrations for the Features section.
 * CSS-only animations — no JS loops. Respects prefers-reduced-motion.
 */

import { useState, useRef, useCallback } from "react";

const styles = `
  .pillar-scroll::-webkit-scrollbar { display: none; }
  .pillar-scroll { scrollbar-width: none; -webkit-overflow-scrolling: touch; }

  @keyframes isoBreath {
    0%, 100% { opacity: 0.25; }
    50% { opacity: 0.35; }
  }

  @media (prefers-reduced-motion: reduce) {
    .iso-animate * {
      animation: none !important;
    }
  }
`;

// ── Shared isometric defs (unique IDs per SVG via prefix) ────────────

function IsoDefs({ p }: { p: string }) {
  return (
    <defs>
      <linearGradient id={`${p}-top`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2e2e32" />
        <stop offset="100%" stopColor="#242427" />
      </linearGradient>
      <linearGradient id={`${p}-front`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#222225" />
        <stop offset="100%" stopColor="#1a1a1d" />
      </linearGradient>
      <linearGradient id={`${p}-side`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#19191c" />
        <stop offset="100%" stopColor="#141416" />
      </linearGradient>
      <filter id={`${p}-sh`}>
        <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.25" />
      </filter>
    </defs>
  );
}

// ── Isometric box helper ─────────────────────────────────────────────
// Draws a 3-face isometric box. Iso angle: slope 0.29 (~16°).
// (x,y) = top-left of front face. W = width, H = height, D = depth.
// Depth direction goes upper-right: (+D, -D*0.5).

function IsoBox({ x, y, w, h, d, p, opacity }: {
  x: number; y: number; w: number; h: number; d: number; p: string; opacity?: number;
}) {
  const s = 0.29; // iso slope
  const ds = 0.5; // depth slope
  return (
    <g opacity={opacity}>
      {/* Front face */}
      <polygon
        points={`${x},${y} ${x + w},${y + w * s} ${x + w},${y + w * s + h} ${x},${y + h}`}
        fill={`url(#${p}-front)`}
      />
      {/* Top face */}
      <polygon
        points={`${x},${y} ${x + w},${y + w * s} ${x + w + d},${y + w * s - d * ds} ${x + d},${y - d * ds}`}
        fill={`url(#${p}-top)`}
      />
      {/* Right side */}
      <polygon
        points={`${x + w},${y + w * s} ${x + w + d},${y + w * s - d * ds} ${x + w + d},${y + w * s - d * ds + h} ${x + w},${y + w * s + h}`}
        fill={`url(#${p}-side)`}
      />
    </g>
  );
}

// ── FIG 1: AI-Powered Compliance ─────────────────────────────────────

function ComplianceIllustration() {
  const P = "c";
  return (
    <svg viewBox="0 0 280 220" className="w-full h-full iso-animate" fill="none">
      <IsoDefs p={P} />

      {/* Ghost documents behind (stacked specs) */}
      <IsoBox x={82} y={52} w={85} h={100} d={10} p={P} opacity={0.07} />
      <IsoBox x={87} y={47} w={85} h={100} d={10} p={P} opacity={0.13} />

      {/* Main isometric document */}
      <g filter={`url(#${P}-sh)`}>
        <IsoBox x={92} y={42} w={85} h={100} d={10} p={P} />

        {/* Header bar on document face */}
        <polygon points="98,50 168,72 168,78 98,56" fill="rgba(255,255,255,0.03)" />

        {/* Text lines (parallel to top edge, slope 0.29) */}
        <line x1="98" y1="64" x2="164" y2="83" stroke="rgba(255,255,255,0.07)" strokeWidth="2" strokeLinecap="round" />
        <line x1="98" y1="74" x2="158" y2="91" stroke="rgba(255,255,255,0.05)" strokeWidth="2" strokeLinecap="round" />
        <line x1="98" y1="84" x2="162" y2="103" stroke="rgba(255,255,255,0.05)" strokeWidth="2" strokeLinecap="round" />
        <line x1="98" y1="94" x2="145" y2="108" stroke="rgba(255,255,255,0.04)" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Shield — dark gray body, thin orange outline */}
      <g>
        <path
          d="M192,118 L210,127 L210,148 Q210,158 192,166 Q174,158 174,148 L174,127 Z"
          fill={`url(#${P}-front)`} stroke="rgba(249,115,22,0.3)" strokeWidth="1"
        />
        {/* Orange checkmark inside */}
        <path d="M185,140 l4,4 8,-8" stroke="rgba(249,115,22,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Green verification dot */}
      <circle cx="104" cy="136" r="3" fill="rgba(34,197,94,0.5)" />
    </svg>
  );
}

// ── FIG 2: Automatic Documentation ───────────────────────────────────

function DocumentationIllustration() {
  const P = "d";
  return (
    <svg viewBox="0 0 280 220" className="w-full h-full iso-animate" fill="none">
      <IsoDefs p={P} />

      {/* ── Isometric phone/tablet (left) ── */}
      <g filter={`url(#${P}-sh)`}>
        <IsoBox x={38} y={58} w={40} h={82} d={8} p={P} />

        {/* Screen (inset from front face) */}
        <polygon points="43,66 73,75 73,130 43,121" fill="#111113" />

        {/* Screen content lines */}
        <line x1="47" y1="76" x2="69" y2="82" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeLinecap="round" />
        <line x1="47" y1="86" x2="67" y2="92" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="47" y1="94" x2="68" y2="100" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="47" y1="102" x2="63" y2="107" stroke="rgba(255,255,255,0.04)" strokeWidth="1.5" strokeLinecap="round" />

        {/* Orange status dot */}
        <circle cx="69" cy="126" r="1.5" fill="#f97316" opacity="0.4" />
      </g>

      {/* ── Data cards in transit (dark gray, static) ── */}
      <IsoBox x={102} y={68} w={24} h={14} d={5} p={P} opacity={0.9} />
      <g>
        <IsoBox x={120} y={95} w={22} h={12} d={5} p={P} opacity={0.85} />
        {/* Faint orange edge on right side of middle card */}
        <polygon
          points={`${120 + 22},${95 + 22 * 0.29} ${120 + 22 + 5},${95 + 22 * 0.29 - 5 * 0.5} ${120 + 22 + 5},${95 + 22 * 0.29 - 5 * 0.5 + 12} ${120 + 22},${95 + 22 * 0.29 + 12}`}
          fill="none" stroke="rgba(249,115,22,0.15)" strokeWidth="1"
        />
      </g>
      <IsoBox x={136} y={56} w={20} h={11} d={5} p={P} opacity={0.8} />

      {/* ── Storage block stack (right) ── */}
      <g filter={`url(#${P}-sh)`}>
        <IsoBox x={172} y={140} w={58} h={22} d={10} p={P} />
      </g>
      <g filter={`url(#${P}-sh)`}>
        <IsoBox x={174} y={112} w={56} h={20} d={10} p={P} />
      </g>
      <g filter={`url(#${P}-sh)`}>
        <IsoBox x={176} y={86} w={54} h={18} d={10} p={P} />
        {/* Green indicator — single small dot */}
        <circle cx="183" cy="94" r="2" fill="rgba(34,197,94,0.45)" />
      </g>
    </svg>
  );
}

// ── FIG 3: Learning from Every Job ───────────────────────────────────

function KnowledgeNetworkIllustration() {
  const P = "k";
  const CX = 140, CY = 108;

  const nodes = [
    { x: 55,  y: 68,  r: 11, green: false },
    { x: 225, y: 60,  r: 10, green: true },
    { x: 40,  y: 155, r: 9,  green: false },
    { x: 105, y: 178, r: 10, green: true },
    { x: 195, y: 180, r: 11, green: false },
    { x: 245, y: 138, r: 9,  green: true },
    { x: 82,  y: 40,  r: 8,  green: false },
  ];

  return (
    <svg viewBox="0 0 280 220" className="w-full h-full iso-animate" fill="none">
      <IsoDefs p={P} />
      <defs>
        <filter id={`${P}-edge`}>
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f97316" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Connection lines — monochromatic dark gray, 2 nearest have faint orange tint */}
      {nodes.map((node, i) => (
        <line
          key={`line-${i}`}
          x1={CX} y1={CY} x2={node.x} y2={node.y}
          stroke={i < 2 ? "rgba(249,115,22,0.06)" : "rgba(255,255,255,0.04)"}
          strokeWidth={node.r > 9 ? 1.5 : 1}
        />
      ))}

      {/* Satellite nodes — static, monochromatic */}
      {nodes.map((node, i) => (
        <g key={`node-${i}`}>
          {/* Shadow */}
          <ellipse cx={node.x} cy={node.y + node.r * 0.6} rx={node.r * 0.8} ry={node.r * 0.25} fill="#000" opacity="0.15" />
          {/* Node body */}
          <circle cx={node.x} cy={node.y} r={node.r} fill={`url(#${P}-front)`} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          {/* Highlight (top-left light source) */}
          <circle cx={node.x - node.r * 0.25} cy={node.y - node.r * 0.25} r={node.r * 0.4} fill="rgba(255,255,255,0.04)" />
          {/* Green activity dot */}
          {node.green && (
            <circle cx={node.x + node.r * 0.5} cy={node.y - node.r * 0.5} r="2" fill="rgba(34,197,94,0.5)" />
          )}
        </g>
      ))}

      {/* ── Central hex core — dark gray prism, thin orange edge highlight ── */}
      <g>
        {/* Top hexagon face — dark gray with thin orange stroke + edge glow */}
        <polygon
          points={`${CX},${CY - 18} ${CX + 20},${CY - 10} ${CX + 20},${CY + 2} ${CX},${CY + 10} ${CX - 20},${CY + 2} ${CX - 20},${CY - 10}`}
          fill={`url(#${P}-top)`}
          stroke="rgba(249,115,22,0.3)" strokeWidth="1"
          filter={`url(#${P}-edge)`}
          style={{ animation: "isoBreath 10s ease-in-out infinite" }}
        />

        {/* Left front face */}
        <polygon
          points={`${CX - 20},${CY + 2} ${CX},${CY + 10} ${CX},${CY + 28} ${CX - 20},${CY + 20}`}
          fill={`url(#${P}-side)`} stroke="rgba(255,255,255,0.03)" strokeWidth="1"
        />
        {/* Right front face */}
        <polygon
          points={`${CX},${CY + 10} ${CX + 20},${CY + 2} ${CX + 20},${CY + 20} ${CX},${CY + 28}`}
          fill={`url(#${P}-front)`} stroke="rgba(255,255,255,0.03)" strokeWidth="1"
        />
      </g>
    </svg>
  );
}

const figures = [
  {
    id: "FIG 1",
    title: "AI-Powered Compliance",
    description: "Every install is verified against manufacturer specs in real-time.",
    Illustration: ComplianceIllustration,
  },
  {
    id: "FIG 2",
    title: "Automatic Documentation",
    description: "Every step captured, timestamped, and stored, without lifting a pen.",
    Illustration: DocumentationIllustration,
  },
  {
    id: "FIG 3",
    title: "Learning from Every Job",
    description: "Maps equipment, failure modes, and proven fixes. Gets smarter with every repair.",
    Illustration: KnowledgeNetworkIllustration,
  },
];

export function IsometricFeatures() {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const cardWidth = el.scrollWidth / figures.length;
    const index = Math.round(scrollLeft / cardWidth);
    setActiveIndex(Math.min(index, figures.length - 1));
  }, []);

  return (
    <div>
      <style>{styles}</style>

      {/* Mobile: horizontal scroll carousel / Desktop: 3-column grid */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="
          flex gap-3 px-4 overflow-x-auto snap-x snap-mandatory scroll-pl-4 pillar-scroll
          md:grid md:grid-cols-3 md:gap-6 md:px-0 md:overflow-visible md:scroll-pl-0
        "
      >
        {figures.map((fig) => (
          <div
            key={fig.id}
            className="
              flex flex-col items-center text-center
              w-[78vw] flex-shrink-0 snap-start
              md:w-auto md:flex-shrink
              bg-[#111113] border border-[#1e1e22] rounded-2xl p-6 md:p-8
            "
          >
            {/* FIG label */}
            <span className="text-[11px] font-mono text-zinc-600 mb-3 tracking-wider">{fig.id}</span>

            {/* Illustration container */}
            <div className="w-full max-w-[280px] aspect-[14/11] mb-4">
              <fig.Illustration />
            </div>

            <h3 className="text-base font-semibold text-white mb-1.5">{fig.title}</h3>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-[260px]">{fig.description}</p>
          </div>
        ))}
      </div>

      {/* Dot indicators — mobile only */}
      <div className="flex justify-center gap-2 mt-4 md:hidden">
        {figures.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 w-1.5 rounded-full transition-colors duration-200 ${
              i === activeIndex ? "bg-orange-500" : "bg-zinc-600"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
