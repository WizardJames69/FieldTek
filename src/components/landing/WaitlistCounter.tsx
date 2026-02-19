import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";
import { motion } from "framer-motion";

interface WaitlistCounterProps {
  className?: string;
}

export function WaitlistCounter({ className }: WaitlistCounterProps) {
  const { data: count, isLoading } = useQuery({
    queryKey: ["waitlist-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("waitlist_signups")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      return count || 0;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  // Don't show if loading or count is very low (less compelling)
  if (isLoading || !count || count < 5) return null;

  // Round to nearest 10 for social proof (avoids exact numbers looking manufactured)
  const displayCount = count >= 10 ? Math.floor(count / 10) * 10 : count;
  const suffix = count >= 10 ? "+" : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className={className}
    >
      <div className="inline-flex items-center gap-2 bg-muted/50 border border-border/50 px-4 py-2 rounded-full">
        <div className="flex -space-x-2">
          {/* Avatar stack simulation */}
          <div className="w-6 h-6 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center">
            <Users className="h-3 w-3 text-primary" />
          </div>
          <div className="w-6 h-6 rounded-full bg-secondary/20 border-2 border-background" />
          <div className="w-6 h-6 rounded-full bg-accent/20 border-2 border-background" />
        </div>
        <span className="text-sm text-muted-foreground">
          Join <span className="font-semibold text-foreground">{displayCount}{suffix}</span> contractors on the waitlist
        </span>
      </div>
    </motion.div>
  );
}
