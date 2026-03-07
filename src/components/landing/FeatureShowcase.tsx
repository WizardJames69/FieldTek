import { MessageSquare, Calendar, FileCheck, CheckCircle2 } from "lucide-react";
import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";
import { SentinelCommandPanel } from "./SentinelCommandPanel";

const features = [
  {
    eyebrow: "Sentinel AI",
    title: "Your documentation, your expert. On every job.",
    description:
      "Sentinel AI reads your uploaded manuals, wiring diagrams, and spec sheets — then delivers step-by-step guidance, code compliance alerts, and diagnostic reasoning directly to your techs in the field.",
    bullets: [
      "Diagnostic reasoning with failure probability analysis",
      "Real-time NEC, IPC, and IMC code compliance alerts",
      "Equipment-specific guidance from uploaded manufacturer documentation",
      "Step-by-step workflow tracking from symptom to resolution",
    ],
    icon: MessageSquare,
    mockup: "ai-assistant",
  },
  {
    eyebrow: "Job Management",
    title: "Dispatch, schedule, and track every job",
    description:
      "Smart job management with recurring maintenance scheduling, technician assignment, and real-time status tracking. Auto-generates jobs for preventive maintenance so nothing slips through the cracks.",
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
    eyebrow: "Compliance & Reporting",
    title: "Documentation that writes itself",
    description:
      "Automatically generates compliance-ready documentation from completed checklists and job data. When the inspector shows up or a warranty claim comes in, you're covered.",
    bullets: [
      "Auto-generated service reports",
      "NEC, IPC, IMC code compliance reference",
      "Warranty verification before job close",
      "Exportable audit trails",
    ],
    icon: FileCheck,
    mockup: "compliance",
  },
];

function FeatureMockup({ type, reverse }: { type: string; reverse: boolean }) {
  if (type === "ai-assistant") {
    return (
      <div className={reverse ? "md:order-first" : ""}>
        <SentinelCommandPanel />
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-white/[0.06] bg-[#111214] overflow-hidden ${reverse ? "md:order-first" : ""}`}>
      <div className="p-1">
        <div className="rounded-lg bg-[#111113] p-4 min-h-[280px] md:min-h-[320px] flex items-center justify-center">
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
    <section className="bg-[#0C0D0F] py-16 md:py-20 lg:py-[100px]">
      <div className="mx-auto max-w-6xl px-4 space-y-16 md:space-y-20 lg:space-y-24">
        {features.map((feature, i) => {
          const reverse = i % 2 !== 0;
          return (
            <div
              key={i}
              className={`grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center`}
            >
              <div className={reverse ? "md:order-last" : ""}>
                <AnimatedEyebrow label={feature.eyebrow} colorClass="text-orange-500" className="mb-3" />
                <ScrollReveal delay={0.05}>
                  <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-4">
                    {feature.title}
                  </h3>
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
