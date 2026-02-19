import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Smartphone, 
  Users, 
  LayoutDashboard, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  MapPin,
  Phone,
  Wrench,
  FileText,
  CreditCard,
  Plus,
  Bell,
  Bot,
  Navigation,
  ClipboardCheck,
  Calendar,
  Settings,
  Zap,
  PhoneOff,
  Eye,
  Route,
  MessageSquare,
  ShieldCheck,
  FileCheck,
  BarChart3
} from "lucide-react";
import { useReducedAnimations } from "@/hooks/useReducedAnimations";
import { cn } from "@/lib/utils";

type TabType = "office" | "field" | "portal";

interface TabOption {
  id: TabType;
  label: string;
  sublabel: string;
  icon: typeof Building2;
  benefits: { icon: typeof CheckCircle2; text: string }[];
}

const tabs: TabOption[] = [
  { 
    id: "office", 
    label: "Office View", 
    sublabel: "Dispatcher Dashboard", 
    icon: Building2,
    benefits: [
      { icon: MessageSquare, text: "Better issue context before dispatch" },
      { icon: Route, text: "Faster routing decisions" },
      { icon: Eye, text: "Centralized service visibility" },
    ]
  },
  { 
    id: "field", 
    label: "Field View", 
    sublabel: "Technician Mobile", 
    icon: Smartphone,
    benefits: [
      { icon: CheckCircle2, text: "Step-by-step on-site guidance" },
      { icon: Zap, text: "AI troubleshooting with history and parts prediction" },
      { icon: PhoneOff, text: "Reduced callbacks with proactive warranty alerts" },
    ]
  },
  { 
    id: "portal", 
    label: "Customer Portal", 
    sublabel: "Client Experience", 
    icon: Users,
    benefits: [
      { icon: ShieldCheck, text: "Self-service request submission" },
      { icon: FileCheck, text: "Real-time job status tracking" },
      { icon: BarChart3, text: "Equipment history and invoices" },
    ]
  },
];

// Animation variants - full animation
const containerVariants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.3, staggerChildren: 0.05 }
  },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.2 } }
};

// Reduced motion variants - instant visibility, no transform animations
const reducedContainerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

const reducedItemVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } }
};

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

// Office Dashboard Mockup - Premium Glass Styling
function OfficeDashboardMockup({ reducedMotion }: { reducedMotion: boolean }) {
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

  const getStatColors = (color: string) => {
    switch (color) {
      case 'primary': return { bg: 'bg-primary/10', text: 'text-primary', glow: '0 0 15px hsl(var(--primary) / 0.2)' };
      case 'blue': return { bg: 'bg-blue-500/10', text: 'text-blue-500', glow: '0 0 15px hsl(217 91% 60% / 0.2)' };
      case 'green': return { bg: 'bg-green-500/10', text: 'text-green-500', glow: '0 0 15px hsl(142 76% 36% / 0.2)' };
      case 'destructive': return { bg: 'bg-destructive/10', text: 'text-destructive', glow: '0 0 15px hsl(var(--destructive) / 0.3)' };
      default: return { bg: 'bg-muted', text: 'text-muted-foreground', glow: 'none' };
    }
  };

  return (
    <motion.div
      variants={reducedMotion ? reducedContainerVariants : containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="bg-background/80 backdrop-blur-xl rounded-xl shadow-xl border border-border/50 overflow-hidden w-full max-w-3xl mx-auto"
    >
      {/* Browser Chrome */}
      <div className="bg-muted/30 backdrop-blur-sm px-4 py-3 border-b border-border/50 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-destructive/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-background/60 rounded px-4 py-1 text-xs text-muted-foreground border border-border/50">
            app.fieldtek.ai/dashboard
          </div>
        </div>
      </div>
      
      {/* Dashboard Content */}
      <div className="p-4 space-y-4">
        {/* Stats Row with 3D depth effect */}
        <motion.div variants={reducedMotion ? reducedItemVariants : itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat, i) => {
            const colors = getStatColors(stat.color);
            return (
              <div 
                key={i} 
                className="stat-card-3d bg-background/60 backdrop-blur-sm rounded-lg p-3 border border-border/50 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <div 
                      className={cn("h-8 w-8 rounded-xl flex items-center justify-center", colors.bg)}
                      style={{ boxShadow: colors.glow }}
                    >
                      <stat.icon className={cn("h-4 w-4", colors.text)} />
                    </div>
                    {stat.trend && (
                      <span className="text-xs text-green-500 font-medium">{stat.trend}</span>
                    )}
                  </div>
                  <div className="text-xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Gradient section divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Jobs List with priority accents */}
          <motion.div variants={reducedMotion ? reducedItemVariants : itemVariants} className="md:col-span-2 bg-background/60 backdrop-blur-sm rounded-lg border border-border/50 p-3">
            <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <div 
                className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center"
                style={{ boxShadow: '0 0 12px hsl(var(--primary) / 0.2)' }}
              >
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              Today's Jobs
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium animate-pulse">
                {jobs.length}
              </span>
            </div>
            <div className="space-y-2">
              {jobs.map((job, i) => {
                const priorityStyles = getPriorityStyles(job.priority);
                return (
                  <div 
                    key={i} 
                    className={cn(
                      "list-item-native flex items-center justify-between bg-background/80 rounded p-2 border border-border/50 transition-all",
                      priorityStyles.border,
                      priorityStyles.shadow,
                      priorityStyles.glow
                    )}
                  >
                    <div>
                      <div className="text-sm font-medium text-foreground">{job.title}</div>
                      <div className="text-xs text-muted-foreground">{job.client}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={job.priority === 'urgent' ? 'destructive' : job.priority === 'high' ? 'default' : 'secondary'}
                        className={cn(
                          "text-xs",
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

          {/* Service Requests */}
          <motion.div variants={reducedMotion ? reducedItemVariants : itemVariants} className="bg-background/60 backdrop-blur-sm rounded-lg border border-border/50 p-3">
            <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <div 
                className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center relative"
                style={{ boxShadow: '0 0 12px hsl(var(--primary) / 0.2)' }}
              >
                <Bell className="h-4 w-4 text-primary" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-destructive rounded-full animate-pulse" />
              </div>
              New Requests
            </div>
            <div className="space-y-2">
              {requests.map((req, i) => (
                <div key={i} className="list-item-native bg-background/80 rounded p-2 border border-border/50 transition-all">
                  <div className="text-sm font-medium text-foreground">{req.title}</div>
                  <div className="text-xs text-muted-foreground">{req.client}</div>
                  <div className="text-xs text-muted-foreground mt-1">{req.time}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// Technician Mobile Mockup - Premium Glass Surface
function TechnicianMobileMockup({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <motion.div
      variants={reducedMotion ? reducedContainerVariants : containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-64 mx-auto"
    >
      {/* Phone Frame with premium styling */}
      <div 
        className="bg-foreground rounded-[2.5rem] p-2 shadow-2xl relative"
        style={{ boxShadow: '0 0 40px hsl(var(--foreground) / 0.15), inset 0 0 20px hsl(var(--foreground) / 0.1)' }}
      >
        {/* Inner glow edge */}
        <div className="absolute inset-1 rounded-[2.3rem] border border-white/10 pointer-events-none" />
        
        <div className="bg-background/95 backdrop-blur-xl rounded-[2rem] overflow-hidden">
          {/* Status Bar with shimmer progress */}
          <div className="bg-muted/30 backdrop-blur-sm px-4 py-2 flex justify-between items-center relative overflow-hidden">
            <span className="text-xs text-muted-foreground">9:41</span>
            <div className="flex gap-1">
              <div className="w-4 h-2 bg-muted-foreground/40 rounded-sm" />
              <div className="w-6 h-2 bg-green-500 rounded-sm" />
            </div>
            {/* Progress shimmer bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-[shimmer_2s_infinite]" />
          </div>

          {/* App Content with glass surface */}
          <div className="p-3 space-y-3 min-h-[400px] bg-gradient-to-b from-background to-background/80">
            {/* Header */}
            <motion.div variants={reducedMotion ? reducedItemVariants : itemVariants} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center"
                  style={{ boxShadow: '0 0 12px hsl(var(--primary) / 0.3)' }}
                >
                  <Wrench className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">My Jobs</div>
                  <div className="text-xs text-muted-foreground">3 assigned today</div>
                </div>
              </div>
              <div className="relative">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-destructive rounded-full animate-pulse" />
              </div>
            </motion.div>

            {/* Push Notification */}
            <motion.div 
              variants={reducedMotion ? reducedItemVariants : itemVariants}
              className="bg-primary/10 backdrop-blur-sm border border-primary/20 rounded-lg p-2.5"
              style={{ boxShadow: '0 0 15px hsl(var(--primary) / 0.1)' }}
            >
              <div className="flex items-center gap-2">
                <div className="p-1 bg-primary/20 rounded-full">
                  <Bell className="h-3 w-3 text-primary" />
                </div>
                <div>
                  <div className="text-xs font-medium text-foreground">New Job Assigned!</div>
                  <div className="text-xs text-muted-foreground">Emergency AC Repair</div>
                </div>
              </div>
            </motion.div>

            {/* Job Card with urgent glow */}
            <motion.div 
              variants={reducedMotion ? reducedItemVariants : itemVariants} 
              className="priority-glow-urgent bg-background/60 backdrop-blur-sm rounded-lg border border-border/50 p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <Badge 
                  variant="destructive" 
                  className="text-xs shadow-[0_0_10px_hsl(var(--destructive)/0.4)]"
                >
                  Urgent
                </Badge>
                <span className="text-xs text-muted-foreground">ETA: 25 min</span>
              </div>
              <div className="text-sm font-semibold text-foreground">Emergency AC Repair</div>
              <div className="text-xs text-muted-foreground mb-2">Johnson Residence</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                <MapPin className="h-3 w-3" />
                1234 Oak Street, Austin TX
              </div>
              <div className="flex gap-1.5">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 text-[10px] h-7 px-2 bg-background/60 min-w-0"
                >
                  <Navigation className="h-3 w-3 mr-0.5 shrink-0" />
                  <span className="truncate">Navigate</span>
                </Button>
                <Button 
                  size="sm" 
                  className="flex-1 text-[10px] h-7 px-2 btn-shimmer min-w-0"
                  style={{ boxShadow: 'inset 0 0 20px hsl(var(--primary) / 0.2)' }}
                >
                  <CheckCircle2 className="h-3 w-3 mr-0.5 shrink-0" />
                  <span className="truncate">Start Job</span>
                </Button>
              </div>
            </motion.div>

            {/* Quick Actions with glass effect */}
            <motion.div variants={reducedMotion ? reducedItemVariants : itemVariants} className="grid grid-cols-2 gap-2">
              <div className="bg-background/60 backdrop-blur-sm rounded-lg border border-border/50 p-2 flex items-center gap-2 transition-all hover:bg-background/80">
                <div 
                  className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center"
                  style={{ boxShadow: '0 0 8px hsl(var(--primary) / 0.15)' }}
                >
                  <ClipboardCheck className="h-3 w-3 text-primary" />
                </div>
                <span className="text-xs text-foreground">Checklist</span>
              </div>
              <div className="bg-background/60 backdrop-blur-sm rounded-lg border border-border/50 p-2 flex items-center gap-2 transition-all hover:bg-background/80">
                <div 
                  className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center"
                  style={{ boxShadow: '0 0 8px hsl(var(--primary) / 0.15)' }}
                >
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <span className="text-xs text-foreground">AI Assistant</span>
              </div>
            </motion.div>

            {/* Call Button */}
            <motion.div variants={reducedMotion ? reducedItemVariants : itemVariants}>
              <Button variant="outline" size="sm" className="w-full text-xs h-8 bg-background/60">
                <Phone className="h-3 w-3 mr-1" />
                Call Customer
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Customer Portal Mockup - Elevated Card Styling
function CustomerPortalMockup({ reducedMotion }: { reducedMotion: boolean }) {
  const stats = [
    { label: "Active Jobs", value: "2", icon: Wrench, color: "blue" },
    { label: "Pending Invoices", value: "$425", icon: CreditCard, color: "amber" },
    { label: "Equipment", value: "4", icon: Settings, color: "muted" },
    { label: "Completed", value: "12", icon: CheckCircle2, color: "green" }
  ];

  const getStatColors = (color: string) => {
    switch (color) {
      case 'blue': return { bg: 'bg-blue-500/10', text: 'text-blue-500', glow: '0 0 12px hsl(217 91% 60% / 0.2)' };
      case 'amber': return { bg: 'bg-amber-500/10', text: 'text-amber-500', glow: '0 0 12px hsl(38 92% 50% / 0.2)' };
      case 'green': return { bg: 'bg-green-500/10', text: 'text-green-500', glow: '0 0 12px hsl(142 76% 36% / 0.2)' };
      default: return { bg: 'bg-muted', text: 'text-muted-foreground', glow: 'none' };
    }
  };

  return (
    <motion.div
      variants={reducedMotion ? reducedContainerVariants : containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="bg-background/80 backdrop-blur-xl rounded-xl shadow-xl border border-border/50 overflow-hidden w-full max-w-md mx-auto"
    >
      {/* Browser Chrome */}
      <div className="bg-muted/30 backdrop-blur-sm px-4 py-3 border-b border-border/50 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-destructive/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-background/60 rounded px-4 py-1 text-xs text-muted-foreground border border-border/50">
            portal.yourcompany.com
          </div>
        </div>
      </div>
      
      {/* Portal Content with glass wrapper */}
      <div className="p-4 space-y-4 bg-gradient-to-b from-background to-background/80">
        {/* Welcome Header */}
        <motion.div variants={reducedMotion ? reducedItemVariants : itemVariants}>
          <div className="text-lg font-semibold text-foreground">Welcome back, Sarah</div>
          <div className="text-sm text-muted-foreground">Manage your services and invoices</div>
        </motion.div>

        {/* Stats Grid with elevated cards */}
        <motion.div variants={reducedMotion ? reducedItemVariants : itemVariants} className="grid grid-cols-2 gap-3">
          {stats.map((stat, i) => {
            const colors = getStatColors(stat.color);
            return (
              <div 
                key={i} 
                className="bg-background/60 backdrop-blur-sm rounded-lg p-3 border border-border/50 relative overflow-hidden"
                style={{ boxShadow: '0 4px 20px hsl(var(--foreground) / 0.05)' }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className="relative">
                  <div 
                    className={cn("h-8 w-8 rounded-xl flex items-center justify-center mb-2", colors.bg)}
                    style={{ boxShadow: colors.glow }}
                  >
                    <stat.icon className={cn("h-4 w-4", colors.text)} />
                  </div>
                  <div className="text-lg font-bold text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Gradient section divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        {/* Quick Actions */}
        <motion.div variants={reducedMotion ? reducedItemVariants : itemVariants} className="space-y-2">
          <div className="text-sm font-semibold text-foreground">Quick Actions</div>
          <div className="grid grid-cols-1 gap-2">
            <Button 
              variant="default" 
              size="sm" 
              className="w-full justify-start text-sm h-9 btn-shimmer"
              style={{ boxShadow: 'inset 0 0 20px hsl(var(--primary) / 0.15)' }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Submit Service Request
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-sm h-9 bg-background/60">
              <FileText className="h-4 w-4 mr-2" />
              View Invoices
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-sm h-9 bg-background/60">
              <Settings className="h-4 w-4 mr-2" />
              View Equipment
            </Button>
          </div>
        </motion.div>

        {/* Recent Job with elevated styling */}
        <motion.div 
          variants={reducedMotion ? reducedItemVariants : itemVariants} 
          className="bg-background/60 backdrop-blur-sm rounded-lg border border-border/50 p-3"
          style={{ boxShadow: '0 4px 20px hsl(var(--foreground) / 0.05)' }}
        >
          <div className="text-xs text-muted-foreground mb-2">Current Service</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">HVAC Maintenance</div>
              <div className="text-xs text-muted-foreground">Scheduled for Feb 3, 2026</div>
            </div>
            <Badge variant="secondary" className="text-xs">Scheduled</Badge>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function RoleInterfaceShowcase() {
  const [activeTab, setActiveTab] = useState<TabType>("office");
  const reducedMotion = useReducedAnimations();
  const activeTabData = tabs.find(t => t.id === activeTab)!;

  return (
    <section className="py-16 sm:py-24 bg-muted/30">
      <div className="container px-4 mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-14">
          <Badge variant="secondary" className="mb-4">
            Built for Every Role
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Benefits for Your Entire Team
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From technicians in the field to leadership in the office, FieldTek delivers 
            value at every level of your organization.
          </p>
        </div>

        {/* Tab Navigation - Glass styling - Always visible on all screen sizes */}
        <div 
          className="flex flex-wrap justify-center gap-2 mb-8 sm:mb-12 p-2 rounded-2xl sm:rounded-full glass-tab mx-auto w-fit max-w-full"
          role="tablist"
          aria-label="Interface views"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-full font-medium text-xs sm:text-sm transition-all duration-200
                focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                ${activeTab === tab.id 
                  ? 'glass-tab-active text-foreground shadow-md' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Benefits for Active Tab */}
        <motion.div 
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap justify-center gap-3 mb-8"
        >
          {activeTabData.benefits.map((benefit, i) => {
            const Icon = benefit.icon;
            return (
              <div 
                key={i}
                className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2"
              >
                <div 
                  className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center"
                  style={{ boxShadow: '0 0 8px hsl(var(--primary) / 0.15)' }}
                >
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm text-foreground">{benefit.text}</span>
              </div>
            );
          })}
        </motion.div>

        {/* Content Area - Responsive Mockups */}
        <div 
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={activeTab}
          className="min-h-[350px] md:min-h-[450px] flex items-start justify-center"
        >
          <div className={activeTab === "office" || activeTab === "portal" ? "md:perspective-mockup" : ""}>
            <AnimatePresence mode="wait">
              {activeTab === "office" && (
                <OfficeDashboardMockup key="office" reducedMotion={reducedMotion} />
              )}
              {activeTab === "field" && (
                <TechnicianMobileMockup key="field" reducedMotion={reducedMotion} />
              )}
              {activeTab === "portal" && (
                <CustomerPortalMockup key="portal" reducedMotion={reducedMotion} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

export default RoleInterfaceShowcase;
