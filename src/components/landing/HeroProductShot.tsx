import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Calendar,
  Bell
} from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/useReducedAnimations";
import { HeroBeamLines } from "./HeroBeamLines";
import { cn } from "@/lib/utils";

const stats = [
  { label: "Total Jobs", value: "24", icon: LayoutDashboard, trend: "+3", color: "primary" },
  { label: "In Progress", value: "8", icon: Clock, color: "blue" },
  { label: "Completed", value: "14", icon: CheckCircle2, color: "green" },
  { label: "Urgent", value: "2", icon: AlertTriangle, color: "destructive" }
];

const jobs = [
  { title: "AC Repair", client: "Johnson Residence", status: "in_progress", priority: "high" },
  { title: "Furnace Install", client: "Martinez Office", status: "scheduled", priority: "medium" },
  { title: "Emergency Leak", client: "Park Plaza", status: "pending", priority: "urgent" }
];

const requests = [
  { title: "HVAC Not Cooling", client: "Smith Home", time: "10 min ago" },
  { title: "Annual Maintenance", client: "Tech Corp", time: "25 min ago" }
];

// Helper for priority-based styling
function getPriorityStyles(priority: string) {
  switch (priority) {
    case 'urgent':
      return {
        border: 'border-l-2 border-l-destructive',
        shadow: 'shadow-[inset_4px_0_12px_-4px_hsl(var(--destructive)/0.15)]',
        glow: 'priority-glow-urgent'
      };
    case 'high':
      return {
        border: 'border-l-2 border-l-warning',
        shadow: 'shadow-[inset_4px_0_12px_-4px_hsl(var(--warning)/0.15)]',
        glow: ''
      };
    default:
      return {
        border: 'border-l-2 border-l-muted-foreground/30',
        shadow: '',
        glow: ''
      };
  }
}

// Helper for stat color styling
function getStatColorStyles(color: string) {
  switch (color) {
    case 'primary':
      return {
        iconBg: 'bg-primary/10',
        iconColor: 'text-primary',
        glowShadow: '0 0 15px hsl(var(--primary) / 0.2)'
      };
    case 'blue':
      return {
        iconBg: 'bg-blue-500/10',
        iconColor: 'text-blue-500',
        glowShadow: '0 0 15px hsl(217 91% 60% / 0.2)'
      };
    case 'green':
      return {
        iconBg: 'bg-green-500/10',
        iconColor: 'text-green-500',
        glowShadow: '0 0 15px hsl(142 76% 36% / 0.2)'
      };
    case 'destructive':
      return {
        iconBg: 'bg-destructive/10',
        iconColor: 'text-destructive',
        glowShadow: '0 0 15px hsl(var(--destructive) / 0.3)'
      };
    default:
      return {
        iconBg: 'bg-muted',
        iconColor: 'text-muted-foreground',
        glowShadow: 'none'
      };
  }
}

export function HeroProductShot() {
  const prefersReducedMotion = usePrefersReducedMotion();

  // Single unified version with responsive adjustments for all screen sizes
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
      className="w-full px-4 mt-8 md:mt-12 mb-4 md:mb-6"
    >
      <div 
        className="relative mx-auto max-w-4xl"
        style={{
          perspective: prefersReducedMotion ? "none" : "1000px"
        }}
      >
        {/* Animated glow orb behind the mockup */}
        <div className="absolute inset-0 bg-primary/15 blur-3xl rounded-full scale-75 -z-10 translate-y-8 orb-pulse" />
        
        {/* Browser Frame with perspective transform and breathing glow */}
        <motion.div 
          className="bg-background/80 backdrop-blur-xl rounded-xl border border-border/50 overflow-hidden hero-glow-animate"
          style={{
            transform: prefersReducedMotion ? "none" : "rotateX(5deg)",
            transformOrigin: "center bottom"
          }}
          whileHover={prefersReducedMotion ? {} : { 
            transform: "rotateX(2deg)",
            transition: { duration: 0.3 }
          }}
        >
          {/* Browser Chrome */}
          <div className="bg-muted/30 backdrop-blur-sm px-3 md:px-4 py-2 md:py-3 border-b border-border/50 flex items-center gap-2">
            <div className="flex gap-1 md:gap-1.5">
              <div className="w-2.5 md:w-3 h-2.5 md:h-3 rounded-full bg-destructive/60" />
              <div className="w-2.5 md:w-3 h-2.5 md:h-3 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 md:w-3 h-2.5 md:h-3 rounded-full bg-green-500/60" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="bg-background/60 rounded px-3 md:px-4 py-0.5 md:py-1 text-[10px] md:text-xs text-muted-foreground border border-border/50">
                app.fieldtek.ai/dashboard
              </div>
            </div>
          </div>
          
          {/* Dashboard Content */}
          <div className="p-3 md:p-4 space-y-3 md:space-y-4">
            {/* Stats Row with glass cards and 3D depth */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
              {stats.map((stat, i) => {
                const colorStyles = getStatColorStyles(stat.color);
                return (
                  <motion.div 
                    key={i} 
                    className="stat-card-3d bg-background/60 backdrop-blur-sm rounded-lg p-2 md:p-3 border border-border/50 relative overflow-hidden group"
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
                  >
                    {/* Inner gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-0.5 md:mb-1">
                        <div 
                          className={cn(
                            "h-6 md:h-8 w-6 md:w-8 rounded-lg md:rounded-xl flex items-center justify-center transition-all duration-300",
                            colorStyles.iconBg
                          )}
                          style={{ boxShadow: colorStyles.glowShadow }}
                        >
                          <stat.icon className={cn("h-3 md:h-4 w-3 md:w-4", colorStyles.iconColor)} />
                        </div>
                        {stat.trend && (
                          <span className="text-[10px] md:text-xs text-green-500 font-medium">{stat.trend}</span>
                        )}
                      </div>
                      <div className="text-base md:text-xl font-bold text-foreground">{stat.value}</div>
                      <div className="text-[10px] md:text-xs text-muted-foreground">{stat.label}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Gradient section divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              {/* Jobs List with priority accents */}
              <motion.div 
                className="md:col-span-2 bg-background/60 backdrop-blur-sm rounded-lg border border-border/50 p-2 md:p-3"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.7 }}
              >
                <div className="text-xs md:text-sm font-semibold text-foreground mb-2 md:mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <div 
                      className="h-5 md:h-7 w-5 md:w-7 rounded-md md:rounded-lg bg-primary/10 flex items-center justify-center"
                      style={{ boxShadow: '0 0 12px hsl(var(--primary) / 0.2)' }}
                    >
                      <Calendar className="h-3 md:h-4 w-3 md:w-4 text-primary" />
                    </div>
                    Today's Jobs
                    <span className="text-[10px] md:text-xs bg-primary/10 text-primary px-1.5 md:px-2 py-0.5 rounded-full font-medium">
                      {jobs.length}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="btn-shimmer text-[10px] md:text-xs h-6 md:h-7 px-2 md:px-3"
                  >
                    View All
                  </Button>
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  {jobs.map((job, i) => {
                    const priorityStyles = getPriorityStyles(job.priority);
                    return (
                      <div 
                        key={i} 
                        className={cn(
                          "list-item-native flex items-center justify-between bg-background/80 rounded p-1.5 md:p-2 border border-border/50 transition-all",
                          priorityStyles.border,
                          priorityStyles.shadow,
                          priorityStyles.glow
                        )}
                      >
                        <div>
                          <div className="text-xs md:text-sm font-medium text-foreground">{job.title}</div>
                          <div className="text-[10px] md:text-xs text-muted-foreground">{job.client}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={job.priority === 'urgent' ? 'destructive' : job.priority === 'high' ? 'default' : 'secondary'}
                            className={cn(
                              "text-[9px] md:text-xs px-1.5 py-0",
                              job.priority === 'urgent' && "shadow-[0_0_10px_hsl(var(--destructive)/0.4)]"
                            )}
                          >
                            {job.priority}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Service Requests with glass styling */}
              <motion.div 
                className="bg-background/60 backdrop-blur-sm rounded-lg border border-border/50 p-2 md:p-3"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.8 }}
              >
                <div className="text-xs md:text-sm font-semibold text-foreground mb-2 md:mb-3 flex items-center gap-1.5 md:gap-2">
                  <div 
                    className="h-5 md:h-7 w-5 md:w-7 rounded-md md:rounded-lg bg-primary/10 flex items-center justify-center relative"
                    style={{ boxShadow: '0 0 12px hsl(var(--primary) / 0.2)' }}
                  >
                    <Bell className="h-3 md:h-4 w-3 md:w-4 text-primary" />
                    {/* Notification pulse */}
                    <span className="absolute -top-0.5 -right-0.5 h-1.5 md:h-2 w-1.5 md:w-2 bg-destructive rounded-full animate-pulse" />
                  </div>
                  New Requests
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  {requests.map((req, i) => (
                    <div 
                      key={i} 
                      className="list-item-native bg-background/80 rounded p-1.5 md:p-2 border border-border/50 transition-all"
                    >
                      <div className="text-xs md:text-sm font-medium text-foreground">{req.title}</div>
                      <div className="text-[10px] md:text-xs text-muted-foreground">{req.client}</div>
                      <div className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">{req.time}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
        
        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none rounded-b-xl" />
        
        {/* Animated beam lines below the product shot */}
        <HeroBeamLines />
      </div>
    </motion.div>
  );
}
