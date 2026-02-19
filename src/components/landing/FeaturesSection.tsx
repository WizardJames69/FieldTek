import { 
  ClipboardCheck, 
  TicketPlus, 
  Database, 
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Camera,
  Cpu,
  Route,
  History,
  Shield,
  TrendingUp,
  Users,
  Wrench,
  Scale,
  BookOpen,
  LucideIcon
} from "lucide-react";
import { memo } from "react";
import { ScrollReveal } from "./ParallaxSection";
import { FloatingOrbs } from "./FloatingOrbs";


interface CapabilityFeature {
  icon: LucideIcon;
  text: string;
}

interface Capability {
  icon: LucideIcon;
  title: string;
  description: string;
  features: CapabilityFeature[];
}

const capabilities: Capability[] = [
  {
    icon: ClipboardCheck,
    title: "Smart Installation & Commissioning Checklists",
    description: "Interactive digital checklists that ensure consistent quality across every job.",
    features: [
      { icon: Wrench, text: "Equipment installation workflows" },
      { icon: CheckCircle2, text: "Startup and commissioning procedures" },
      { icon: AlertTriangle, text: "Real-time validation flags missing or unsafe data" },
      { icon: FileCheck, text: "Auto-generates documentation for warranty & compliance" },
    ]
  },
  {
    icon: TicketPlus,
    title: "Recurring Maintenance Scheduling",
    description: "Automate preventive maintenance with smart scheduling that generates jobs in advance.",
    
    features: [
      { icon: History, text: "Weekly, monthly, quarterly, or annual schedules" },
      { icon: Route, text: "Auto-generates jobs ahead of time" },
      { icon: Users, text: "Auto-assign to preferred technicians" },
      { icon: Database, text: "Linked to equipment for complete history" },
    ]
  },
  {
    icon: Database,
    title: "Asset Management & Warranty Tracking",
    description: "Centralized equipment history with AI-powered insights for every asset in your portfolio.",
    
    features: [
      { icon: Database, text: "Serial number tracking with full service history" },
      { icon: History, text: "AI-powered recurring issue detection" },
      { icon: Shield, text: "Proactive warranty expiration alerts" },
      { icon: TrendingUp, text: "Parts prediction based on repair patterns" },
    ]
  },
  {
    icon: BarChart3,
    title: "Mobile Offline Mode",
    description: "Keep technicians productive even without signal — sync automatically when back online.",
    
    features: [
      { icon: Camera, text: "View jobs, clients & checklists offline" },
      { icon: CheckCircle2, text: "Complete checklists and update status" },
      { icon: Cpu, text: "Background sync when connection restores" },
      { icon: Shield, text: "No work lost, even in basements or remote sites" },
    ]
  },
  {
    icon: Scale,
    title: "Instant Code Compliance Reference",
    description: "Look up US and Canadian building and trade codes on the job site — no manuals to carry, no documents to upload.",
    
    features: [
      { icon: BookOpen, text: "NEC & CEC electrical codes" },
      { icon: BookOpen, text: "IPC & NPC plumbing codes" },
      { icon: BookOpen, text: "IMC mechanical codes" },
      { icon: Shield, text: "CSA & ASME standards" },
    ]
  }
];

// Static feature item
const FeatureItem = memo(function FeatureItem({
  feature,
}: {
  feature: CapabilityFeature;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
      <feature.icon className="h-4 w-4 text-primary flex-shrink-0" />
      <span className="text-sm text-foreground">{feature.text}</span>
    </div>
  );
});

// Fully static capability card — no motion, no useInView
const CapabilityCard = memo(function CapabilityCard({
  capability,
}: {
  capability: Capability;
}) {
  return (
    <div
      className="bg-card border border-border rounded-2xl p-8 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 transition-all duration-300 group card-glow"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        e.currentTarget.style.setProperty('--mouse-x', `${x}%`);
        e.currentTarget.style.setProperty('--mouse-y', `${y}%`);
      }}
    >
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors overflow-hidden">
          <capability.icon className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {capability.title}
          </h3>
          <p className="text-muted-foreground">
            {capability.description}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {capability.features.map((feature, featureIndex) => (
          <FeatureItem
            key={featureIndex}
            feature={feature}
          />
        ))}
      </div>
    </div>
  );
});

export const FeaturesSection = memo(function FeaturesSection() {
  return (
    <section id="features" className="relative py-20 bg-muted/30 overflow-hidden section-fade-top layered-bg">
      <div className="absolute inset-0 grid-pattern -z-10" />
      <FloatingOrbs variant="mixed" count={2} intensity="subtle" />
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-10 right-[10%] w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
        <div className="absolute bottom-20 left-[5%] w-48 h-48 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <ScrollReveal direction="up">
          <div className="text-center max-w-3xl mx-auto mb-16 header-spotlight">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
              <ClipboardCheck className="h-4 w-4" />
              Core Capabilities
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Purpose-Built for Field Operations
            </h2>
            <p className="text-lg text-muted-foreground">
              From installation checklists to warranty tracking, every feature is designed to 
              standardize quality, reduce callbacks, and protect your business.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {capabilities.map((capability, index) => (
            <CapabilityCard
              key={index}
              capability={capability}
            />
          ))}
        </div>
      </div>
    </section>
  );
});