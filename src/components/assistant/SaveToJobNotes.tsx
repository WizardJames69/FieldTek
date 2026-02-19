import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StickyNote, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SaveToJobNotesProps {
  jobId: string;
  content: string;
  disabled?: boolean;
}

export function SaveToJobNotes({ jobId, content, disabled }: SaveToJobNotesProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async () => {
    if (!jobId || !content.trim() || isSaved) return;

    setIsSaving(true);

    try {
      // Get current job notes
      const { data: job, error: fetchError } = await supabase
        .from("scheduled_jobs")
        .select("notes")
        .eq("id", jobId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // Format the AI insight to append
      const timestamp = new Date().toLocaleString();
      const formattedInsight = `\n\n--- AI Assistant Note (${timestamp}) ---\n${content.slice(0, 500)}${content.length > 500 ? "..." : ""}`;

      const updatedNotes = (job?.notes || "") + formattedInsight;

      // Update job notes
      const { error: updateError } = await supabase
        .from("scheduled_jobs")
        .update({ notes: updatedNotes })
        .eq("id", jobId);

      if (updateError) throw updateError;

      setIsSaved(true);
      toast.success("Saved to job notes");
    } catch (error) {
      console.error("Error saving to job notes:", error);
      toast.error("Failed to save to job notes");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-xs gap-1"
      onClick={handleSave}
      disabled={disabled || isSaving || isSaved || !jobId}
      title={isSaved ? "Saved to job notes" : "Save to job notes"}
    >
      {isSaving ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isSaved ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <StickyNote className="h-3 w-3" />
      )}
      {isSaved ? "Saved" : "Save to Job"}
    </Button>
  );
}
