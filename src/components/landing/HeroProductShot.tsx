import { Lock } from "lucide-react";
import dashboardShot from "@/assets/landing/dashboard-hero.webp";

/**
 * Real product screenshot (North Shore HVAC synthetic demo tenant) inside the
 * hero's browser chrome. Replaced the hand-built div-art mockup (PR-LAND-SHOT-1)
 * so the landing page shows the actual dashboard: KPIs, quick actions, today's
 * board with assignees, and live requests. The image is the hero's LCP
 * candidate: eager + high fetch priority, explicit dimensions, WebP under
 * 150 KB at retina resolution.
 */
export function HeroProductShot() {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] bg-[#0F0F11] shrink-0">
        <div className="flex gap-1.5">
          <div className="w-[6px] h-[6px] rounded-full bg-[#FF5F57]/40" />
          <div className="w-[6px] h-[6px] rounded-full bg-[#FEBC2E]/40" />
          <div className="w-[6px] h-[6px] rounded-full bg-[#28C840]/40" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-[#1A1B1E] rounded-md px-3 py-1 flex items-center gap-1.5">
            <Lock className="h-2.5 w-2.5 text-[#4B5563]" />
            <span className="text-[11px] text-[#4B5563] font-mono">app.fieldtek.ai/dashboard</span>
          </div>
        </div>
      </div>

      {/* Real dashboard screenshot */}
      <div className="relative flex-1 min-h-0">
        <img
          src={dashboardShot}
          alt="FieldTek dashboard showing today's service calls, technician assignments, new customer requests, and key metrics for a sample HVAC company"
          width={3200}
          height={1660}
          loading="eager"
          decoding="async"
          // React 18 has no typed fetchPriority prop; the lowercase DOM
          // attribute passes through untouched and hints the LCP fetch.
          {...({ fetchpriority: "high" } as object)}
          className="h-full w-full object-cover object-top"
        />
        <p className="absolute bottom-2 right-3 z-20 text-[10px] text-zinc-400/80">
          Product shown with sample data.
        </p>
      </div>
    </div>
  );
}
