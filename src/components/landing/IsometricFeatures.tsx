/**
 * Three animated isometric SVG illustrations for the Features section.
 * CSS-only animations — no JS loops. Respects prefers-reduced-motion.
 */

const styles = `
  @keyframes isoGlow {
    0%, 100% { opacity: 0.15; }
    50% { opacity: 0.4; }
  }
  @keyframes isoNodePulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
  @keyframes isoDotTravel {
    0% { offset-distance: 0%; opacity: 0; }
    8% { opacity: 1; }
    92% { opacity: 1; }
    100% { offset-distance: 100%; opacity: 0; }
  }
  @keyframes isoFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  @keyframes isoDocShift {
    0%, 100% { transform: translateY(0); opacity: 0.7; }
    50% { transform: translateY(-2px); opacity: 1; }
  }
  @keyframes isoFlash {
    0%, 85%, 100% { opacity: 0.4; }
    90% { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .iso-animate * {
      animation: none !important;
    }
  }
`;

/** FIG 1: AI-Powered Compliance — documents → AI node → verified docs */
function ComplianceIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full iso-animate" fill="none">
      {/* Input document stack (left) */}
      <g>
        {/* Doc 3 (back) */}
        <rect x="30" y="100" width="60" height="75" rx="4" fill="#1E1F22" stroke="rgba(255,255,255,0.06)" strokeWidth="1"
          style={{ animation: "isoDocShift 4.5s ease-in-out infinite 0.3s" }} />
        {/* Doc 2 */}
        <rect x="38" y="92" width="60" height="75" rx="4" fill="#1A1C1E" stroke="rgba(255,255,255,0.06)" strokeWidth="1"
          style={{ animation: "isoDocShift 4s ease-in-out infinite 0.15s" }} />
        {/* Doc 1 (front) */}
        <rect x="46" y="84" width="60" height="75" rx="4" fill="#161819" stroke="rgba(255,255,255,0.08)" strokeWidth="1"
          style={{ animation: "isoDocShift 3.5s ease-in-out infinite" }} />
        {/* Doc lines */}
        <line x1="54" y1="98" x2="94" y2="98" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
        <line x1="54" y1="108" x2="88" y2="108" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
        <line x1="54" y1="118" x2="92" y2="118" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
        <line x1="54" y1="128" x2="80" y2="128" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
      </g>

      {/* Central AI node */}
      <g style={{ animation: "isoFloat 5s ease-in-out infinite" }}>
        {/* Glow */}
        <circle cx="160" cy="120" r="32" fill="#f97316" opacity="0.06"
          style={{ animation: "isoGlow 4s ease-in-out infinite" }} />
        {/* Hexagon-ish shape */}
        <polygon points="160,88 185,104 185,136 160,152 135,136 135,104"
          fill="#161819" stroke="rgba(249,115,22,0.25)" strokeWidth="1.5" />
        {/* AI icon lines */}
        <circle cx="160" cy="115" r="8" stroke="rgba(249,115,22,0.5)" strokeWidth="1.5" fill="none" />
        <line x1="155" y1="130" x2="160" y2="138" stroke="rgba(249,115,22,0.4)" strokeWidth="1.5" />
        <line x1="165" y1="130" x2="160" y2="138" stroke="rgba(249,115,22,0.4)" strokeWidth="1.5" />
      </g>

      {/* Connection lines — left to center */}
      <line x1="106" y1="120" x2="135" y2="120" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 3" />
      {/* Data dot traveling left→center */}
      <circle r="2.5" fill="#f97316" opacity="0.7"
        style={{
          offsetPath: "path('M106,120 L135,120')",
          animation: "isoDotTravel 2.5s ease-in-out infinite",
        }} />

      {/* Connection lines — center to right */}
      <line x1="185" y1="120" x2="214" y2="120" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 3" />
      {/* Data dot traveling center→right */}
      <circle r="2.5" fill="#f97316" opacity="0.7"
        style={{
          offsetPath: "path('M185,120 L214,120')",
          animation: "isoDotTravel 2.5s ease-in-out infinite 1.2s",
        }} />

      {/* Output verified documents (right) */}
      <g>
        <rect x="214" y="84" width="60" height="75" rx="4" fill="#161819" stroke="rgba(255,255,255,0.08)" strokeWidth="1"
          style={{ animation: "isoDocShift 4s ease-in-out infinite 0.5s" }} />
        {/* Doc lines */}
        <line x1="222" y1="98" x2="262" y2="98" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
        <line x1="222" y1="108" x2="256" y2="108" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
        <line x1="222" y1="118" x2="260" y2="118" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
        {/* Checkmark */}
        <circle cx="258" cy="140" r="8" fill="rgba(34,197,94,0.12)" />
        <path d="M253 140l3 3 6-6" stroke="rgba(34,197,94,0.6)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** FIG 2: Automatic Documentation — mobile → pipeline → cloud storage */
function DocumentationIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full iso-animate" fill="none">
      {/* Mobile device (left) */}
      <g style={{ animation: "isoNodePulse 3s ease-in-out infinite" }}>
        <rect x="30" y="72" width="50" height="90" rx="8" fill="#161819" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
        {/* Screen */}
        <rect x="36" y="82" width="38" height="64" rx="3" fill="#111113" />
        {/* Screen content lines */}
        <line x1="42" y1="94" x2="68" y2="94" stroke="rgba(249,115,22,0.3)" strokeWidth="1.5" />
        <line x1="42" y1="104" x2="64" y2="104" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
        <line x1="42" y1="114" x2="66" y2="114" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
        <line x1="42" y1="124" x2="60" y2="124" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
        {/* Home indicator */}
        <line x1="48" y1="155" x2="62" y2="155" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Pipeline — 3 stage arrows */}
      {/* Stage 1: Capture */}
      <rect x="100" y="100" width="40" height="36" rx="6" fill="#1A1C1E" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <text x="120" y="122" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="monospace">CAP</text>

      {/* Stage 2: Process */}
      <rect x="156" y="100" width="40" height="36" rx="6" fill="#1A1C1E" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <text x="176" y="122" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="monospace">PRO</text>

      {/* Stage 3: Store */}
      <rect x="212" y="100" width="40" height="36" rx="6" fill="#1A1C1E" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <text x="232" y="122" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="monospace">STO</text>

      {/* Connection paths */}
      <line x1="80" y1="118" x2="100" y2="118" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 3" />
      <line x1="140" y1="118" x2="156" y2="118" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 3" />
      <line x1="196" y1="118" x2="212" y2="118" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 3" />
      <line x1="252" y1="118" x2="270" y2="118" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 3" />

      {/* Data dots traveling along pipeline */}
      <circle r="2.5" fill="#f97316" opacity="0.7"
        style={{
          offsetPath: "path('M80,118 L100,118')",
          animation: "isoDotTravel 2s ease-in-out infinite",
        }} />
      <circle r="2.5" fill="#f97316" opacity="0.7"
        style={{
          offsetPath: "path('M140,118 L156,118')",
          animation: "isoDotTravel 2s ease-in-out infinite 0.7s",
        }} />
      <circle r="2.5" fill="#f97316" opacity="0.7"
        style={{
          offsetPath: "path('M196,118 L212,118')",
          animation: "isoDotTravel 2s ease-in-out infinite 1.4s",
        }} />
      <circle r="2.5" fill="#f97316" opacity="0.7"
        style={{
          offsetPath: "path('M252,118 L270,118')",
          animation: "isoDotTravel 2s ease-in-out infinite 2.1s",
        }} />

      {/* Cloud storage (right) */}
      <g style={{ animation: "isoFlash 5s ease-in-out infinite" }}>
        <rect x="270" y="88" width="36" height="60" rx="6" fill="#161819" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
        {/* Cloud icon simplified */}
        <ellipse cx="288" cy="110" rx="10" ry="7" fill="none" stroke="rgba(249,115,22,0.3)" strokeWidth="1.5" />
        <line x1="282" y1="126" x2="294" y2="126" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1="284" y1="132" x2="292" y2="132" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      </g>
    </svg>
  );
}

/** FIG 3: Knowledge Network — connected nodes */
function KnowledgeNetworkIllustration() {
  // Node positions
  const nodes = [
    { cx: 160, cy: 120, r: 14, label: "AI", primary: true, pulse: 3 },
    { cx: 80, cy: 80, r: 10, label: "", primary: false, pulse: 4 },
    { cx: 240, cy: 80, r: 10, label: "", primary: false, pulse: 5 },
    { cx: 60, cy: 150, r: 8, label: "", primary: false, pulse: 3.5 },
    { cx: 120, cy: 180, r: 9, label: "", primary: false, pulse: 4.5 },
    { cx: 200, cy: 180, r: 9, label: "", primary: false, pulse: 2.5 },
    { cx: 260, cy: 150, r: 8, label: "", primary: false, pulse: 4.2 },
    { cx: 100, cy: 50, r: 7, label: "", primary: false, pulse: 3.8 },
    { cx: 220, cy: 50, r: 7, label: "", primary: false, pulse: 4.8 },
  ];

  // Connections (index pairs)
  const connections = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
    [1, 7], [2, 8], [1, 3], [2, 6], [4, 5],
  ];

  return (
    <svg viewBox="0 0 320 240" className="w-full h-full iso-animate" fill="none">
      {/* Connection lines */}
      {connections.map(([a, b], i) => (
        <g key={`conn-${i}`}>
          <line
            x1={nodes[a].cx} y1={nodes[a].cy}
            x2={nodes[b].cx} y2={nodes[b].cy}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
          {/* Traveling dot on some connections */}
          {i < 6 && (
            <circle r="2" fill="#f97316" opacity="0.6"
              style={{
                offsetPath: `path('M${nodes[a].cx},${nodes[a].cy} L${nodes[b].cx},${nodes[b].cy}')`,
                animation: `isoDotTravel ${2.5 + i * 0.3}s ease-in-out infinite ${i * 0.5}s`,
              }} />
          )}
        </g>
      ))}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <g key={`node-${i}`} style={{ animation: `isoNodePulse ${node.pulse}s ease-in-out infinite` }}>
          {node.primary && (
            <circle cx={node.cx} cy={node.cy} r={node.r + 8} fill="#f97316" opacity="0.05"
              style={{ animation: "isoGlow 4s ease-in-out infinite" }} />
          )}
          <circle
            cx={node.cx} cy={node.cy} r={node.r}
            fill={node.primary ? "#161819" : "#1A1C1E"}
            stroke={node.primary ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}
            strokeWidth={node.primary ? 1.5 : 1}
          />
          {node.primary && (
            <text x={node.cx} y={node.cy + 3.5} textAnchor="middle" fill="rgba(249,115,22,0.5)" fontSize="9" fontFamily="monospace" fontWeight="bold">
              AI
            </text>
          )}
          {/* Small inner dot for non-primary nodes */}
          {!node.primary && (
            <circle cx={node.cx} cy={node.cy} r={2} fill="rgba(255,255,255,0.1)" />
          )}
        </g>
      ))}
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
    description: "Every step captured, timestamped, and stored — without lifting a pen.",
    Illustration: DocumentationIllustration,
  },
  {
    id: "FIG 3",
    title: "Learning from Every Job",
    description: "Maps equipment, failure modes, and proven fixes — gets smarter with every repair.",
    Illustration: KnowledgeNetworkIllustration,
  },
];

export function IsometricFeatures() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0">
      <style>{styles}</style>
      {figures.map((fig, i) => (
        <div
          key={fig.id}
          className={`flex flex-col items-center text-center px-6 py-4 ${
            i < figures.length - 1 ? "md:border-r md:border-white/[0.06]" : ""
          }`}
        >
          {/* FIG label */}
          <span className="text-[11px] font-mono text-zinc-600 mb-3 tracking-wider">{fig.id}</span>

          {/* Illustration container */}
          <div className="w-full max-w-[280px] aspect-[4/3] mb-4">
            <fig.Illustration />
          </div>

          <h3 className="text-base font-semibold text-white mb-1.5">{fig.title}</h3>
          <p className="text-sm text-zinc-500 leading-relaxed max-w-[260px]">{fig.description}</p>
        </div>
      ))}
    </div>
  );
}
