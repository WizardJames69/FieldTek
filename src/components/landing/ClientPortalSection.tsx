import { CheckCircle2 } from "lucide-react";
import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";

const bullets = [
  "Branded service request submission",
  "Real-time job status tracking for clients",
  "Quote approval and digital signatures",
  "Automatic notifications at every stage",
];

function PortalMockup() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111214] overflow-hidden">
      <div className="p-1">
        <div className="rounded-lg bg-[#111113] p-4 min-h-[280px] md:min-h-[320px] space-y-4">
          {/* Form mockup */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-zinc-300 mb-2">New Service Request</div>
            <div className="space-y-2">
              <div className="rounded-md bg-zinc-800/80 border border-zinc-700/50 px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-zinc-400">Issue Type</span>
                <span className="text-xs text-zinc-300">HVAC — Not Cooling</span>
              </div>
              <div className="rounded-md bg-zinc-800/80 border border-zinc-700/50 px-3 py-2">
                <span className="text-xs text-zinc-400">Location</span>
                <span className="text-xs text-zinc-300 ml-2">Unit 4B, 2nd Floor</span>
              </div>
              <div className="rounded-md bg-zinc-800/80 border border-zinc-700/50 px-3 py-2 min-h-[36px]">
                <span className="text-xs text-zinc-400">AC stopped cooling yesterday. Thermostat reads 78°F...</span>
              </div>
              <div className="flex justify-end">
                <div className="bg-orange-500/90 text-white text-[10px] font-medium px-3 py-1.5 rounded-md">
                  Submit Request
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-zinc-800" />

          {/* Submitted request card */}
          <div className="rounded-md bg-[#141416] border border-zinc-800 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-zinc-200">HVAC Not Cooling — Unit 4B</div>
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Technician Assigned
              </span>
            </div>
            <div className="text-xs text-zinc-500">Smith Property Management</div>

            {/* Timeline */}
            <div className="flex items-center gap-2 pt-1">
              {[
                { label: "Submitted", active: true },
                { label: "Assigned", active: true },
                { label: "In Progress", active: false },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        step.active ? "bg-orange-500" : "bg-zinc-700"
                      }`}
                    />
                    <span
                      className={`text-[10px] ${
                        step.active ? "text-zinc-300" : "text-zinc-600"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div
                      className={`w-6 h-px ${
                        step.active ? "bg-orange-500/50" : "bg-zinc-800"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClientPortalSection() {
  return (
    <section className="bg-[#0C0D0F] py-16 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div>
            <AnimatedEyebrow label="CLIENT PORTAL" colorClass="text-orange-500" className="mb-3" />
            <ScrollReveal delay={0.05}>
              <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-4">
                Give your clients a front door
              </h3>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="text-zinc-400 leading-relaxed mb-6">
                A branded portal where property managers, building owners, and homeowners
                submit service requests, track job progress, and approve quotes — without
                calling your office.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.15}>
              <ul className="space-y-2.5">
                {bullets.map((bullet, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm text-zinc-400">
                    <CheckCircle2 className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
          <ScrollReveal delay={0.1}>
            <PortalMockup />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
