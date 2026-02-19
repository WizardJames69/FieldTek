import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Bell, Info, AlertTriangle, Megaphone, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { format } from "date-fns";

interface Announcement {
  id: string;
  title: string;
  content: string;
  announcement_type: string;
  priority: number;
  is_dismissible: boolean;
  created_at: string;
  published_at: string | null;
  target_tiers: string[] | null;
  target_roles: string[] | null;
}

const typeConfig: Record<string, { icon: typeof Sparkles; color: string; label: string }> = {
  feature: { icon: Sparkles, color: "text-primary", label: "New Feature" },
  update: { icon: Bell, color: "text-blue-500", label: "Update" },
  info: { icon: Info, color: "text-muted-foreground", label: "Info" },
  warning: { icon: AlertTriangle, color: "text-warning", label: "Important" },
  announcement: { icon: Megaphone, color: "text-accent", label: "Announcement" },
};

export function WhatsNewDialog() {
  const [open, setOpen] = useState(false);
  const [hasNewAnnouncements, setHasNewAnnouncements] = useState(false);
  const { user } = useAuth();
  const { tenant, role } = useTenant();
  const queryClient = useQueryClient();

  // Fetch active announcements
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements", user?.id, tenant?.subscription_tier, role],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get all published announcements
      const { data: allAnnouncements, error: annError } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_published", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("priority", { ascending: false })
        .order("published_at", { ascending: false });

      if (annError) throw annError;

      // Get user's dismissed announcements
      const { data: dismissals, error: disError } = await supabase
        .from("announcement_dismissals")
        .select("announcement_id")
        .eq("user_id", user.id);

      if (disError) throw disError;

      const dismissedIds = new Set(dismissals?.map((d) => d.announcement_id) || []);

      // Filter out dismissed and apply targeting
      const filtered = (allAnnouncements || []).filter((ann) => {
        // Skip dismissed
        if (dismissedIds.has(ann.id)) return false;

        // Check tier targeting
        const targetTiers = ann.target_tiers as string[] | null;
        if (targetTiers && targetTiers.length > 0) {
          if (!tenant?.subscription_tier || !targetTiers.includes(tenant.subscription_tier)) {
            return false;
          }
        }

        // Check role targeting
        const targetRoles = ann.target_roles as string[] | null;
        if (targetRoles && targetRoles.length > 0) {
          if (!role || !targetRoles.includes(role)) {
            return false;
          }
        }

        return true;
      }) as Announcement[];

      return filtered;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation to dismiss announcement
  const dismissMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase.from("announcement_dismissals").insert({
        user_id: user.id,
        announcement_id: announcementId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });

  // Check for new announcements and show dialog
  useEffect(() => {
    if (announcements.length > 0 && !isLoading) {
      setHasNewAnnouncements(true);
      
      // Auto-show dialog on first login if there are high priority announcements
      const hasHighPriority = announcements.some((a) => a.priority >= 80);
      const shownKey = `whats-new-shown-${user?.id}`;
      const lastShown = localStorage.getItem(shownKey);
      const today = new Date().toDateString();
      
      if (hasHighPriority && lastShown !== today) {
        setOpen(true);
        localStorage.setItem(shownKey, today);
      }
    } else {
      setHasNewAnnouncements(false);
    }
  }, [announcements, isLoading, user?.id]);

  const handleDismiss = async (id: string) => {
    await dismissMutation.mutateAsync(id);
  };

  const handleDismissAll = async () => {
    for (const ann of announcements.filter((a) => a.is_dismissible)) {
      await dismissMutation.mutateAsync(ann.id);
    }
    setOpen(false);
  };

  if (!user || announcements.length === 0) return null;

  return (
    <>
      {/* Floating indicator button */}
      <AnimatePresence>
        {hasNewAnnouncements && !open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-20 right-4 z-40 md:bottom-6"
          >
            <Button
              onClick={() => setOpen(true)}
              className="rounded-full shadow-lg gap-2 bg-primary hover:bg-primary/90"
              size="sm"
            >
              <Sparkles className="h-4 w-4" />
              What's New
              <Badge variant="secondary" className="ml-1 bg-primary-foreground/20 text-primary-foreground">
                {announcements.length}
              </Badge>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-br from-primary/5 to-transparent">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              What's New
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Recent updates and announcements
            </p>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh]">
            <div className="p-4 space-y-3">
              <AnimatePresence mode="popLayout">
                {announcements.map((announcement, index) => {
                  const config = typeConfig[announcement.announcement_type] || typeConfig.info;
                  const Icon = config.icon;

                  return (
                    <motion.div
                      key={announcement.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative group bg-card border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-muted/50 ${config.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {config.label}
                            </Badge>
                            {announcement.published_at && (
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(announcement.published_at), "MMM d")}
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold text-foreground mb-1">
                            {announcement.title}
                          </h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {announcement.content}
                          </p>
                        </div>
                        {announcement.is_dismissible && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2"
                            onClick={() => handleDismiss(announcement.id)}
                            disabled={dismissMutation.isPending}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismissAll}
              disabled={dismissMutation.isPending || !announcements.some((a) => a.is_dismissible)}
            >
              Dismiss all
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Got it
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
