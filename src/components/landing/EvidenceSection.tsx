import { CheckCircle2, ShieldCheck, ClipboardCheck, Scale, UserCheck } from "lucide-react";
import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";

// ── Evidence Mockup ────────────────────────────────────────────

function EvidenceMockup() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111214] overflow-hidden">
      <div className="p-1">
        <div className="rounded-lg bg-[#111113] p-4 min-h-0 md:min-h-[340px] space-y-3">
          {/* Header */}
          <div className="text-xs font-medium text-zinc-300 mb-1">Workflow Step Evidence</div>

          {/* Step 1: Completed with photo */}
          <div className="rounded-md bg-[#141416] border border-zinc-800 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-zinc-200">Step 2: Capacitor Test</span>
              </div>
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Verified
              </span>
            </div>

            {/* Photo placeholder */}
            <div className="rounded-md bg-zinc-800/80 border border-zinc-700/50 h-20 flex items-center justify-center mb-2">
              <div className="text-center">
                <div className="text-zinc-600 text-[10px] mb-0.5">Photo Evidence</div>
                <div className="w-8 h-6 rounded bg-zinc-700/50 mx-auto flex items-center justify-center">
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                    <rect x="0.5" y="0.5" width="11" height="9" rx="1" stroke="rgba(255,255,255,0.15)" />
                    <circle cx="4" cy="3.5" r="1.5" fill="rgba(255,255,255,0.1)" />
                    <path d="M1 8l3-3 2 2 2-3 3 4H1z" fill="rgba(255,255,255,0.08)" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-3 text-[10px] text-zinc-500">
              <span>10:42 AM</span>
              <span>37.7749, -122.4194</span>
              <span className="text-emerald-500">AI Verified</span>
            </div>
          </div>

          {/* Step 2: Completed with photo */}
          <div className="rounded-md bg-[#141416] border border-zinc-800 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-zinc-200">Step 3: Wiring Verification</span>
              </div>
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Verified
              </span>
            </div>

            {/* Photo placeholder */}
            <div className="rounded-md bg-zinc-800/80 border border-zinc-700/50 h-20 flex items-center justify-center mb-2">
              <div className="text-center">
                <div className="text-zinc-600 text-[10px] mb-0.5">Photo Evidence</div>
                <div className="w-8 h-6 rounded bg-zinc-700/50 mx-auto flex items-center justify-center">
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                    <rect x="0.5" y="0.5" width="11" height="9" rx="1" stroke="rgba(255,255,255,0.15)" />
                    <circle cx="4" cy="3.5" r="1.5" fill="rgba(255,255,255,0.1)" />
                    <path d="M1 8l3-3 2 2 2-3 3 4H1z" fill="rgba(255,255,255,0.08)" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-3 text-[10px] text-zinc-500">
              <span>10:58 AM</span>
              <span>37.7749, -122.4194</span>
              <span className="text-emerald-500">AI Verified</span>
            </div>
          </div>

          {/* Step 3: Current */}
          <div className="rounded-md bg-[#141416] border border-orange-500/20 p-3">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 rounded-full border-2 border-orange-500 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              </div>
              <span className="text-xs font-medium text-orange-400">Step 4: Startup Test — Photo Required</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Benefits ───────────────────────────────────────────────────

const benefits = [
  { icon: ShieldCheck, label: "Warranty protection" },
  { icon: ClipboardCheck, label: "Inspection readiness" },
  { icon: Scale, label: "Dispute defense" },
  { icon: UserCheck, label: "Full accountability" },
];

// ── Section ────────────────────────────────────────────────────

export function EvidenceSection() {
  return (
    <section className="bg-[#0C0D0F] py-6 md:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div>
            <AnimatedEyebrow label="Evidence & Accountability" colorClass="text-orange-500" className="mb-3" />
            <ScrollReveal delay={0.05}>
              <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-4">
                Every step documented. Every claim defensible.
              </h3>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="text-zinc-400 leading-relaxed mb-6">
                Technicians capture photo evidence at each workflow step. Every photo is timestamped,
                geotagged, and tied to the specific step in the repair process. When a warranty claim
                comes in or an inspector asks questions, you have step-by-step proof.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.15}>
              <div className="grid grid-cols-2 gap-3">
                {benefits.map((benefit, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <benefit.icon className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    <span className="text-sm text-zinc-400">{benefit.label}</span>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>
          <ScrollReveal delay={0.1}>
            <EvidenceMockup />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
