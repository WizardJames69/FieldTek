import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Technician {
  user_id: string;
  full_name: string;
  jobCount: number;
}

interface TechnicianSidebarProps {
  technicians: Technician[];
  selectedTechnician: string | null;
  onSelectTechnician: (id: string | null) => void;
}

export function TechnicianSidebar({
  technicians,
  selectedTechnician,
  onSelectTechnician,
}: TechnicianSidebarProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvailabilityConfig = (jobCount: number) => {
    if (jobCount === 0) return { ring: 'ring-success', dot: 'bg-success', label: 'Available' };
    if (jobCount <= 2) return { ring: 'ring-primary', dot: 'bg-primary', label: 'Light' };
    if (jobCount <= 4) return { ring: 'ring-warning', dot: 'bg-warning', label: 'Busy' };
    return { ring: 'ring-destructive', dot: 'bg-destructive', label: 'Overloaded' };
  };

  const getBadgeVariant = (jobCount: number): 'success' | 'default' | 'warning' | 'destructive' => {
    if (jobCount === 0) return 'success';
    if (jobCount <= 2) return 'default';
    if (jobCount <= 4) return 'warning';
    return 'destructive';
  };

  return (
    <Card variant="glass" className="h-full shadow-lg">
      <CardHeader className="pb-3 border-b border-border/20">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
            <span className="text-sm font-bold text-primary">{technicians.length}</span>
          </div>
          <CardTitle className="text-base font-semibold">Technicians</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-4">
        {/* All Technicians button */}
        <button
          onClick={() => onSelectTechnician(null)}
          className={cn(
            "w-full p-3.5 rounded-xl text-left transition-all duration-200 touch-native",
            selectedTechnician === null
              ? "bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/40 ring-1 ring-primary/20 shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)]"
              : "bg-muted/30 hover:bg-muted/50 border border-transparent hover:border-border/50"
          )}
        >
          <span className="text-sm font-semibold">All Technicians</span>
          <span className="text-xs text-muted-foreground block mt-0.5">View entire team</span>
        </button>

        {/* Technician list */}
        {technicians.map((tech) => {
          const availability = getAvailabilityConfig(tech.jobCount);
          const isSelected = selectedTechnician === tech.user_id;
          
          return (
            <button
              key={tech.user_id}
              onClick={() => onSelectTechnician(tech.user_id)}
              className={cn(
                "w-full p-3 rounded-xl text-left transition-all duration-200 flex items-center gap-3 touch-native group",
                isSelected
                  ? "bg-primary/10 border border-primary/40 ring-1 ring-primary/20 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.3)]"
                  : "hover:bg-muted/60 border border-transparent hover:border-border/50"
              )}
            >
              {/* Avatar with availability ring */}
              <div className="relative">
                <Avatar className={cn(
                  "h-9 w-9 ring-2 ring-offset-2 ring-offset-background transition-all",
                  availability.ring,
                  isSelected && "ring-offset-primary/10"
                )}>
                  <AvatarFallback className="text-xs font-semibold bg-muted/70 text-foreground">
                    {getInitials(tech.full_name || "?")}
                  </AvatarFallback>
                </Avatar>
                {/* Status dot */}
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background shadow-sm",
                    availability.dot
                  )}
                />
              </div>
              
              {/* Name and job count */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium truncate transition-colors",
                  isSelected && "text-primary"
                )}>
                  {tech.full_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tech.jobCount} job{tech.jobCount !== 1 ? "s" : ""} today
                </p>
              </div>
              
              {/* Job count badge */}
              <Badge 
                variant={getBadgeVariant(tech.jobCount)}
                glow={tech.jobCount === 0}
                className="text-xs font-semibold"
              >
                {tech.jobCount}
              </Badge>
            </button>
          );
        })}

        {technicians.length === 0 && (
          <div className="empty-state-native py-6">
            <p className="text-sm text-muted-foreground">
              No technicians found
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
