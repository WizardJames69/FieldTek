import { Calendar, FileCheck, CheckCircle2 } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

// The Sentinel AI deep-dive lives in SentinelSection (demo-led); this
// showcase covers the rest of the platform so the AI story is told once.
const features = [
  {
    title: "Jobs that run the way you designed them",
    description:
      "Define your workflows once. FieldTek enforces the right steps, assigns the right people, and auto-generates recurring maintenance jobs. Your process becomes your standard, not a suggestion.",
    bullets: [
      "Drag-and-drop scheduling",
      "Recurring maintenance automation",
      "Real-time job status for office and field",
      "Client portal for service request submission",
    ],
    icon: Calendar,
    mockup: "job-management",
  },
  {
    title: "Every job documented, start to finish",
    description:
      "Checklists, photos, and timestamps are captured as your techs work. When the inspector shows up or a warranty claim comes in, the record is already there.",
    bullets: [
      "Step-by-step job records with photo evidence",
      "NEC, IPC, IMC code compliance reference",
      "Equipment warranty dates tracked on every unit",
      "Complete, timestamped job history",
    ],
    icon: FileCheck,
    mockup: "compliance",
  },
];

function FeatureMockup({ type, reverse }: { type: string; reverse: boolean }) {
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-[var(--landing-surface-raised)] overflow-hidden ${reverse ? "md:order-first" : ""}`}>
      <div className="p-1">
        <div className="rounded-lg bg-[var(--landing-panel)] p-4 min-h-0 md:min-h-[320px] flex items-center justify-center">
          {type === "job-management" && (
            <div className="w-full space-y-2">
              {[
                { title: "AC Replacement - Johnson", status: "In Progress", color: "text-blue-400" },
                { title: "Furnace Commissioning - Martinez", status: "Scheduled", color: "text-zinc-400" },
                { title: "Quarterly HVAC Maintenance - TechCorp", status: "Auto-Generated", color: "text-orange-400" },
              ].map((job, i) => (
                <div key={i} className="flex items-center justify-between bg-zinc-800/80 rounded-lg px-3 py-2.5 border border-zinc-700/50">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">{job.title}</div>
                  </div>
                  <span className={`text-[10px] font-medium ${job.color}`}>{job.status}</span>
                </div>
              ))}
            </div>
          )}
          {type === "compliance" && (
            <div className="w-full space-y-3">
              <div className="text-xs font-medium text-zinc-300 mb-2">Installation Compliance Check</div>
              {[
                { label: "Electrical connections per wiring diagram", checked: true },
                { label: "Refrigerant charge within OEM spec", checked: true },
                { label: "Condensate drain slope verified", checked: true },
                { label: "Startup procedure documented", checked: false },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs">
                  <div className={`h-4 w-4 rounded flex items-center justify-center flex-shrink-0 ${item.checked ? "bg-emerald-500/20" : "bg-zinc-800 border border-zinc-700"}`}>
                    {item.checked && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                  </div>
                  <span className={item.checked ? "text-zinc-300" : "text-zinc-500"}>{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FeatureShowcase() {
  return (
    <section className="bg-[var(--landing-surface)] py-6 md:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl px-4 space-y-12 md:space-y-20 lg:space-y-24">
        {features.map((feature, i) => {
          const reverse = i % 2 !== 0;
          return (
            <div
              key={i}
              className={`grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center`}
            >
              <div className={reverse ? "md:order-last" : ""}>
                <ScrollReveal>
                  <h2 className="font-landing-display text-2xl md:text-3xl font-bold text-white tracking-tight mb-4">
                    {feature.title}
                  </h2>
                </ScrollReveal>
                <ScrollReveal delay={0.1}>
                  <p className="text-zinc-400 leading-relaxed mb-6">{feature.description}</p>
                </ScrollReveal>
                <ScrollReveal delay={0.15}>
                  <ul className="space-y-2.5">
                    {feature.bullets.map((bullet, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm text-zinc-400">
                        <CheckCircle2 className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </ScrollReveal>
              </div>
              <ScrollReveal delay={0.1}>
                <FeatureMockup type={feature.mockup} reverse={reverse} />
              </ScrollReveal>
            </div>
          );
        })}
      </div>
    </section>
  );
}
