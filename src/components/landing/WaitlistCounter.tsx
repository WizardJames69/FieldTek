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
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  if (isLoading || !count || count < 5) return null;

  const displayCount = count >= 10 ? Math.floor(count / 10) * 10 : count;
  const suffix = count >= 10 ? "+" : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className={className}
    >
      <div className="inline-flex items-center gap-2 border border-zinc-800 px-4 py-2 rounded-full bg-zinc-900/50">
        <div className="flex -space-x-2">
          <div className="w-6 h-6 rounded-full bg-orange-500/20 border-2 border-zinc-900 flex items-center justify-center">
            <Users className="h-3 w-3 text-orange-500" />
          </div>
          <div className="w-6 h-6 rounded-full bg-zinc-700/50 border-2 border-zinc-900" />
          <div className="w-6 h-6 rounded-full bg-zinc-700/50 border-2 border-zinc-900" />
        </div>
        <span className="text-sm text-zinc-400">
          Join <span className="font-semibold text-zinc-200">{displayCount}{suffix}</span> contractors on the waitlist
        </span>
      </div>
    </motion.div>
  );
}
