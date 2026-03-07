import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Bell,
  Lock,
} from "lucide-react";

const stats = [
  { label: "Total Jobs", value: "24", icon: LayoutDashboard, trend: "+3" },
  { label: "In Progress", value: "8", icon: Clock },
  { label: "Completed", value: "14", icon: CheckCircle2 },
  { label: "Urgent", value: "2", icon: AlertTriangle },
];

const jobs = [
  { title: "AC Unit Replacement", client: "Johnson Residence", status: "In Progress", priority: "high" },
  { title: "Furnace Commissioning", client: "Martinez Office Park", status: "Scheduled", priority: "medium" },
  { title: "Emergency Refrigerant Leak", client: "Park Plaza Hotel", status: "Pending", priority: "urgent" },
];

const requests = [
  { title: "HVAC Not Cooling - Unit 4B", client: "Smith Home", time: "10 min ago" },
  { title: "Annual Maintenance Due", client: "TechCorp HQ", time: "25 min ago" },
];

export function HeroProductShot() {
  return (
    <div className="h-full w-full">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] bg-[#0F0F11]">
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

      {/* Dashboard content */}
      <div className="p-4 md:p-6 space-y-4 bg-[#111113]">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="rounded-lg bg-[#18181B] border border-white/[0.04] p-3 animate-in fade-in-0 duration-500"
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: "backwards" }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="h-7 w-7 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <stat.icon className="h-3.5 w-3.5 text-zinc-400" />
                </div>
                {stat.trend && (
                  <span className="text-xs text-emerald-400 font-medium animate-pulse [animation-iteration-count:3]">{stat.trend}</span>
                )}
              </div>
              <div className="text-lg font-bold text-white">{stat.value}</div>
              <div className="text-xs text-zinc-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-zinc-800" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Jobs list */}
          <div className="md:col-span-2 rounded-lg bg-[#141516] border border-white/[0.04] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-orange-500/10 flex items-center justify-center">
                  <Calendar className="h-3.5 w-3.5 text-orange-500" />
                </div>
                <span className="text-sm font-semibold text-white">Today's Jobs</span>
                <span className="text-xs bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full font-medium">
                  {jobs.length}
                </span>
              </div>
              <span className="text-xs text-zinc-500 hover:text-zinc-400 cursor-pointer">View All</span>
            </div>
            <div className="space-y-2">
              {jobs.map((job, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-md p-2.5 border border-white/[0.04] ${
                    job.priority === "urgent"
                      ? "border-l-2 border-l-red-500 bg-red-500/5"
                      : job.priority === "high"
                      ? "border-l-2 border-l-amber-500 bg-[#141416]"
                      : "bg-[#141416]"
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-200">{job.title}</div>
                    <div className="text-xs text-zinc-500">{job.client}</div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      job.status === "In Progress"
                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/[0.08]"
                        : job.status === "Scheduled"
                        ? "border-blue-500/30 text-blue-400 bg-blue-500/[0.08]"
                        : job.status === "Pending"
                        ? "border-amber-500/30 text-amber-400 bg-amber-500/[0.08]"
                        : "border-zinc-700 text-zinc-400"
                    }`}
                  >
                    {job.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Service requests */}
          <div className="rounded-lg bg-[#161819] border border-white/[0.04] p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-md bg-orange-500/10 flex items-center justify-center relative">
                <Bell className="h-3.5 w-3.5 text-orange-500" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full" />
              </div>
              <span className="text-sm font-semibold text-white">New Requests</span>
            </div>
            <div className="space-y-2">
              {requests.map((req, i) => (
                <div key={i} className="rounded-md bg-[#141416] border border-white/[0.04] p-2.5">
                  <div className="text-sm font-medium text-zinc-200">{req.title}</div>
                  <div className="text-xs text-zinc-500">{req.client}</div>
                  <div className="text-xs text-zinc-600 mt-1">{req.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
