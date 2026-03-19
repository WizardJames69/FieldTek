/**
 * Three animated isometric SVG illustrations for the Features section.
 * CSS-only animations — no JS loops. Respects prefers-reduced-motion.
 */

import { useState, useRef, useCallback } from "react";

const styles = `
  .pillar-scroll::-webkit-scrollbar { display: none; }
  .pillar-scroll { scrollbar-width: none; -webkit-overflow-scrolling: touch; }

  @media (prefers-reduced-motion: reduce) {
    .iso-animate * {
      animation: none !important;
    }
  }
`;

// ── FIG 1: AI-Powered Compliance — Frontal Checklist ─────────────────

function ComplianceIllustration() {
  // Clipboard dimensions centered in 280×220 viewBox
  const cx = 140, w = 110, h = 140;
  const x = cx - w / 2, y = (220 - h) / 2;
  const rowY = (i: number) => y + 40 + i * 26;

  const rows = [
    { checked: true, textW: 70 },
    { checked: true, textW: 58 },
    { checked: true, textW: 65 },
    { checked: false, textW: 50 },
  ];

  return (
    <svg viewBox="0 0 280 220" className="w-full h-full" fill="none">
      <defs>
        <filter id="c-sh">
          <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#000" floodOpacity="0.3" />
        </filter>
        <filter id="c-stamp">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f97316" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Ghost clipboard behind */}
      <rect x={x + 4} y={y - 4} width={w} height={h} rx="6" fill="#1e1e22" opacity="0.08" />

      {/* Main clipboard */}
      <g filter="url(#c-sh)">
        <rect x={x} y={y} width={w} height={h} rx="6" fill="#1e1e22" />

        {/* Header bar */}
        <rect x={x} y={y} width={w} height="16" rx="6" fill="#252528" />
        {/* Flatten bottom corners of header */}
        <rect x={x} y={y + 10} width={w} height="6" fill="#252528" />

        {/* Checklist rows */}
        {rows.map((row, i) => (
          <g key={i}>
            {row.checked ? (
              <>
                <circle cx={x + 18} cy={rowY(i)} r="5" fill="rgba(34,197,94,0.6)" />
                <path
                  d={`M${x + 15},${rowY(i)} l2,2 4,-4`}
                  stroke="#fff" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"
                />
              </>
            ) : (
              <circle cx={x + 18} cy={rowY(i)} r="5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            )}
            <rect x={x + 30} y={rowY(i) - 2} width={row.textW} height="4" rx="2" fill="#2a2a2e" />
          </g>
        ))}
      </g>

      {/* Orange "verified" stamp — bottom right */}
      <g filter="url(#c-stamp)">
        <circle cx={x + w - 8} cy={y + h - 8} r="12" fill="#1e1e22" stroke="rgba(249,115,22,0.5)" strokeWidth="1" />
        <path
          d={`M${x + w - 12},${y + h - 8} l2.5,2.5 5,-5`}
          stroke="rgba(249,115,22,0.6)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

// ── FIG 2: Automatic Documentation — Large Phone Screen ──────────────

function DocumentationIllustration() {
  // Phone dimensions centered in 280×220 viewBox
  const pw = 96, ph = 152;
  const px = (280 - pw) / 2, py = (220 - ph) / 2;
  // Screen inset
  const sx = px + 6, sy = py + 14, sw = pw - 12, sh = ph - 28;

  const rowY = (i: number) => sy + 16 + i * 34;

  return (
    <svg viewBox="0 0 280 220" className="w-full h-full" fill="none">
      <defs>
        <filter id="d-sh">
          <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#000" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Phone frame */}
      <g filter="url(#d-sh)">
        <rect x={px} y={py} width={pw} height={ph} rx="12" fill="#1e1e22" stroke="#2a2a2e" strokeWidth="1" />

        {/* Screen */}
        <rect x={sx} y={sy} width={sw} height={sh} rx="4" fill="#161618" />

        {/* Row 1 — current/latest (orange dot) */}
        <circle cx={sx + 10} cy={rowY(0)} r="3" fill="rgba(249,115,22,0.5)" />
        <rect x={sx + 20} y={rowY(0) - 2} width="42" height="4" rx="2" fill="#2a2a2e" />
        <rect x={sx + sw - 20} y={rowY(0) - 1.5} width="14" height="3" rx="1.5" fill="#222225" />

        {/* Separator */}
        <line x1={sx + 4} y1={rowY(0) + 15} x2={sx + sw - 4} y2={rowY(0) + 15} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

        {/* Row 2 — completed (green dot) */}
        <circle cx={sx + 10} cy={rowY(1)} r="3" fill="rgba(34,197,94,0.5)" />
        <rect x={sx + 20} y={rowY(1) - 2} width="38" height="4" rx="2" fill="#2a2a2e" />
        <rect x={sx + sw - 20} y={rowY(1) - 1.5} width="14" height="3" rx="1.5" fill="#222225" />

        {/* Separator */}
        <line x1={sx + 4} y1={rowY(1) + 15} x2={sx + sw - 4} y2={rowY(1) + 15} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

        {/* Row 3 — photo capture placeholder */}
        <circle cx={sx + 10} cy={rowY(2)} r="3" fill="rgba(34,197,94,0.5)" />
        <rect x={sx + 20} y={rowY(2) - 6} width="22" height="14" rx="2" fill="#19191c" stroke="#2a2a2e" strokeWidth="0.5" />
        <rect x={sx + 48} y={rowY(2) - 2} width="24" height="4" rx="2" fill="#2a2a2e" />

        {/* Home indicator */}
        <line x1={px + pw / 2 - 14} y1={py + ph - 8} x2={px + pw / 2 + 14} y2={py + ph - 8} stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ── FIG 3: Learning from Every Job — Clean Network ───────────────────

function KnowledgeNetworkIllustration() {
  const CX = 140, CY = 110, CR = 28;

  const nodes = [
    { x: 55,  y: 55,  r: 14, green: false },
    { x: 230, y: 65,  r: 13, green: true },
    { x: 50,  y: 170, r: 13, green: false },
    { x: 220, y: 175, r: 7,  green: true },
    { x: 140, y: 195, r: 8,  green: false },
  ];

  return (
    <svg viewBox="0 0 280 220" className="w-full h-full" fill="none">
      <defs>
        <filter id="k-glow">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f97316" floodOpacity="0.2" />
        </filter>
        <radialGradient id="k-node" cx="0.4" cy="0.35" r="0.6">
          <stop offset="0%" stopColor="#2a2a2e" />
          <stop offset="100%" stopColor="#1e1e22" />
        </radialGradient>
      </defs>

      {/* Connection lines — center to satellites only */}
      {nodes.map((node, i) => (
        <line
          key={`line-${i}`}
          x1={CX} y1={CY} x2={node.x} y2={node.y}
          stroke="#2a2a2e" strokeWidth={node.r > 10 ? 2 : 1}
        />
      ))}

      {/* Satellite nodes */}
      {nodes.map((node, i) => (
        <g key={`node-${i}`}>
          <circle cx={node.x} cy={node.y} r={node.r} fill="url(#k-node)" />
          {/* Top-light highlight */}
          <circle cx={node.x - node.r * 0.2} cy={node.y - node.r * 0.2} r={node.r * 0.45} fill="rgba(255,255,255,0.03)" />
          {/* Green activity dot */}
          {node.green && (
            <circle cx={node.x + node.r * 0.55} cy={node.y - node.r * 0.65} r="3" fill="rgba(34,197,94,0.6)" />
          )}
        </g>
      ))}

      {/* Center node — dominant AI core */}
      <circle cx={CX} cy={CY} r={CR} fill="#1e1e22" stroke="rgba(249,115,22,0.35)" strokeWidth="1" filter="url(#k-glow)" />
      {/* Inner highlight */}
      <circle cx={CX - 4} cy={CY - 6} r={CR * 0.4} fill="rgba(255,255,255,0.03)" />
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
              flex flex-col
              w-[78vw] flex-shrink-0 snap-start
              md:w-auto md:flex-shrink
              bg-[#111113] border border-[#1e1e22] rounded-2xl p-6 md:p-8
            "
          >
            {/* FIG label */}
            <span className="text-[11px] font-mono text-zinc-600 mb-3 tracking-wider">{fig.id}</span>

            {/* Illustration container */}
            <div className="w-full max-w-[280px] aspect-[14/11] mb-4 mx-auto">
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
