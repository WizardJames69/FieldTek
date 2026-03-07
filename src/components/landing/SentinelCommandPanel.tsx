import { useEffect, useRef, useState, useCallback } from "react";

// ── Data ──────────────────────────────────────────────────────────────────────

const causes = [
  { label: "Failed capacitor", pct: 72, primary: true },
  { label: "Contactor failure", pct: 18, primary: false },
  { label: "Refrigerant leak", pct: 10, primary: false },
];

const workflowSteps = [
  { label: "Symptom identified", status: "done" as const },
  { label: "Manuals retrieved", status: "done" as const },
  { label: "Failure probability calculated", status: "done" as const },
  { label: "Technician test required", status: "current" as const },
  { label: "Pending repair confirmation", status: "pending" as const },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function SentinelCommandPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasPlayedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const [phase, setPhase] = useState(0); // 0 = hidden, increments through animation phases
  const [barWidths, setBarWidths] = useState([0, 0, 0]);
  const [confidence, setConfidence] = useState(0);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const speed = isMobile ? 0.7 : 1;

  const schedule = useCallback(
    (fn: () => void, delayMs: number) => {
      const id = window.setTimeout(fn, delayMs * speed);
      timersRef.current.push(id);
    },
    [speed],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || hasPlayedRef.current) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const threshold = isMobile ? 0.1 : 0.2;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasPlayedRef.current) {
          hasPlayedRef.current = true;
          observer.disconnect();

          if (prefersReduced) {
            setPhase(20);
            setBarWidths([72, 18, 10]);
            setConfidence(92);
            return;
          }

          // Animation sequence
          schedule(() => setPhase(1), 0);       // container
          schedule(() => setPhase(2), 200);      // top bar
          schedule(() => setPhase(3), 400);      // system/symptom
          schedule(() => setPhase(4), 800);      // probability header
          schedule(() => {
            setPhase(5);
            setBarWidths([72, 0, 0]);
          }, 1000); // first bar
          schedule(() => setBarWidths([72, 18, 0]), 1200);
          schedule(() => setBarWidths([72, 18, 10]), 1400);
          schedule(() => setPhase(6), 1600);     // recommended step

          // Center column
          schedule(() => setPhase(7), 1000);     // steps 1-3
          schedule(() => setPhase(8), 1600);     // step 4
          schedule(() => setPhase(9), 2000);     // step 5

          // Right column
          schedule(() => setPhase(10), 1200);    // compliance alert
          schedule(() => setPhase(11), 1800);    // documentation
          schedule(() => {
            setPhase(12);
            // Animate confidence counter
            let current = 0;
            const step = () => {
              current += 2;
              if (current > 92) current = 92;
              setConfidence(current);
              if (current < 92) {
                const id = window.setTimeout(step, 15);
                timersRef.current.push(id);
              }
            };
            step();
          }, 2200);
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      timersRef.current.forEach(clearTimeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ty = isMobile ? 5 : 8;

  const vis = (minPhase: number) =>
    phase >= minPhase
      ? { opacity: 1, transform: "translateY(0)" }
      : { opacity: 0, transform: `translateY(${ty}px)` };

  const transBase = "transition-all duration-300 ease-out";

  return (
    <div
      ref={containerRef}
      className="rounded-xl md:rounded-2xl border border-white/[0.06] bg-[#0C0D0F] overflow-hidden"
      style={{
        ...vis(1),
        touchAction: "manipulation",
      }}
    >
      {/* ─── Top bar ─────────────────────────────────────────────── */}
      <div
        className={`flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-[#111214] ${transBase}`}
        style={vis(2)}
      >
        {/* Icon */}
        <div className="w-6 h-6 rounded-md bg-orange-500/10 flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 14 14" className="text-orange-500">
            <polygon
              points="7,1 12.5,4 12.5,10 7,13 1.5,10 1.5,4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <circle cx="7" cy="7" r="1.5" fill="currentColor" />
          </svg>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-1.5 min-w-0">
          <span className="text-sm font-semibold text-white whitespace-nowrap">
            Sentinel AI
          </span>
          <span className="text-xs text-[#6B7280] truncate">
            <span className="hidden sm:inline">· </span>Carrier 24ACC636 · No Cooling
          </span>
        </div>

        {/* Live dot */}
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs text-emerald-500 font-medium hidden sm:inline">
            Live
          </span>
        </div>
      </div>

      {/* ─── Three columns ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[35%_30%_35%]">
        {/* ── LEFT: Sentinel Analysis ───────────────────────────── */}
        <div className="bg-[#111214] p-4 md:p-5 order-1">
          <div
            className={`text-[11px] uppercase tracking-widest text-[#6B7280] mb-3 ${transBase}`}
            style={vis(3)}
          >
            Sentinel Analysis
          </div>

          <div className={`space-y-0.5 mb-4 ${transBase}`} style={vis(3)}>
            <p className="text-sm font-semibold text-white">
              System: Carrier 24ACC636
            </p>
            <p className="text-sm text-[#9CA3AF]">Symptom: No cooling</p>
          </div>

          <div
            className={`border-t border-white/[0.06] pt-3 mb-3 ${transBase}`}
            style={vis(4)}
          >
            <div className="text-[11px] uppercase tracking-widest text-[#6B7280] mb-3">
              Most probable causes
            </div>
          </div>

          <div className="space-y-3">
            {causes.map((c, i) => (
              <div
                key={c.label}
                className={transBase}
                style={vis(5)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white">{c.label}</span>
                  <span
                    className={`text-sm font-medium ${c.primary ? "text-orange-500" : "text-[#9CA3AF]"}`}
                  >
                    {barWidths[i]}%
                  </span>
                </div>
                <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-[600ms] ease-out"
                    style={{
                      width: `${barWidths[i]}%`,
                      backgroundColor: c.primary
                        ? "#F97316"
                        : "rgba(249,115,22,0.4)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            className={`border-t border-white/[0.06] pt-3 mt-4 ${transBase}`}
            style={vis(6)}
          >
            <div className="text-[11px] uppercase tracking-widest text-[#6B7280] mb-2">
              Recommended next step
            </div>
            <p className="text-sm text-orange-500 font-medium">
              → Test capacitor microfarads
            </p>
          </div>
        </div>

        {/* ── CENTER: Diagnostic Workflow ────────────────────────── */}
        <div className="bg-[#0E0F11] p-4 md:p-5 order-3 md:order-2">
          <div
            className={`text-[11px] uppercase tracking-widest text-[#6B7280] mb-4 ${transBase}`}
            style={vis(7)}
          >
            Diagnostic Workflow
          </div>

          <div className="relative pl-6">
            {/* Vertical connecting line */}
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/[0.06]" />

            <div className="space-y-4">
              {workflowSteps.map((step, i) => {
                const stepNum = i + 1;
                let minPhase: number;
                if (stepNum <= 3) minPhase = 7;
                else if (stepNum === 4) minPhase = 8;
                else minPhase = 9;

                return (
                  <div
                    key={step.label}
                    className={`relative flex items-start gap-3 ${transBase}`}
                    style={{
                      ...vis(minPhase),
                      transitionDelay: stepNum <= 3 ? `${(stepNum - 1) * 150}ms` : "0ms",
                    }}
                  >
                    {/* Indicator */}
                    <div className="absolute -left-6 top-0.5 flex items-center justify-center w-[14px] h-[14px]">
                      {step.status === "done" && (
                        <svg width="14" height="14" viewBox="0 0 14 14">
                          <circle cx="7" cy="7" r="6" fill="#22C55E" />
                          <path
                            d="M4.5 7L6.5 9L9.5 5"
                            fill="none"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                      {step.status === "current" && (
                        <span className="text-orange-500 text-xs font-bold">→</span>
                      )}
                      {step.status === "pending" && (
                        <div className="w-2.5 h-2.5 rounded-full border-2 border-[#4B5563]" />
                      )}
                    </div>

                    <div>
                      <span className="text-xs text-[#6B7280] mr-1.5">
                        Step {stepNum}
                      </span>
                      <span
                        className={`text-sm ${
                          step.status === "done"
                            ? "text-white"
                            : step.status === "current"
                              ? "text-orange-500 font-medium"
                              : "text-[#6B7280]"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Compliance & Documentation ─────────────────── */}
        <div className="bg-[#111214] p-4 md:p-5 order-2 md:order-3">
          {/* Compliance alert */}
          <div
            className={`border-l-2 pl-3 mb-4 ${transBase}`}
            style={{
              ...vis(10),
              borderColor: "rgba(245,158,11,0.5)",
            }}
          >
            <div className="text-[11px] uppercase tracking-widest text-[#F59E0B] mb-2 flex items-center gap-1">
              <span>⚠</span> Compliance Alert
            </div>
            <p className="text-sm text-[#E0E0E0] mb-2">
              Potential NEC violation detected.
            </p>
            <div className="space-y-0.5 mb-2">
              <p className="text-sm">
                <span className="text-[#9CA3AF]">Breaker size: </span>
                <span className="text-[#EF4444] font-medium">30A</span>
              </p>
              <p className="text-sm">
                <span className="text-[#9CA3AF]">Required breaker: </span>
                <span className="text-[#22C55E] font-medium">40A</span>
              </p>
            </div>
            <p className="text-[13px] text-[#9CA3AF] leading-relaxed mb-2">
              Risk: Undersized breaker may trip during compressor startup.
            </p>
            <div>
              <span className="text-[13px] text-[#6B7280]">
                Recommendation:{" "}
              </span>
              <span className="text-sm text-white">
                Upgrade to 40A per NEC 440.22
              </span>
            </div>
          </div>

          {/* Documentation */}
          <div
            className={`border-t border-white/[0.06] pt-3 ${transBase}`}
            style={vis(11)}
          >
            <div className="text-[11px] uppercase tracking-widest text-[#6B7280] mb-3">
              Relevant Documentation
            </div>
            <p className="text-sm font-semibold text-white mb-0.5">
              Carrier Installation Manual
            </p>
            <p className="text-[13px] text-[#6B7280] mb-2">Page 47</p>
            <p className="text-sm text-[#9CA3AF] italic leading-relaxed mb-3">
              "Minimum breaker size for 24ACC636 units is 40A when compressor
              load exceeds specified threshold."
            </p>
            <p className="text-[13px]">
              <span className="text-[#6B7280]">Confidence: </span>
              <span className="text-[#22C55E] font-medium">{confidence}%</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
