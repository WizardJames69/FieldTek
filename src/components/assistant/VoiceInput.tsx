import { useState, useCallback } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled = false }: VoiceInputProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      setCurrentTranscript(data.text);
    },
    onCommittedTranscript: (data) => {
      if (data.text.trim()) {
        onTranscript(data.text.trim());
      }
      setCurrentTranscript("");
    },
  });

  const handleToggle = useCallback(async () => {
    if (scribe.isConnected) {
      scribe.disconnect();
      setCurrentTranscript("");
      return;
    }

    setIsConnecting(true);
    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get token from edge function
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");

      if (error || !data?.token) {
        throw new Error(error?.message || "Failed to get transcription token");
      }

      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (error) {
      console.error("Voice input error:", error);
      if (error instanceof Error && error.name === "NotAllowedError") {
        toast.error("Microphone access denied. Please enable microphone in your browser settings.");
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to start voice input");
      }
    } finally {
      setIsConnecting(false);
    }
  }, [scribe, onTranscript]);

  const isRecording = scribe.isConnected;

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={isRecording ? "destructive" : "ghost"}
        size="icon"
        className={cn(
          "h-8 w-8 transition-all",
          isRecording && "animate-pulse"
        )}
        onClick={handleToggle}
        disabled={disabled || isConnecting}
        title={isRecording ? "Stop recording" : "Start voice input"}
      >
        {isConnecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
      
      {/* Show live partial transcript */}
      {currentTranscript && (
        <span className="text-xs text-muted-foreground italic truncate max-w-[200px]">
          {currentTranscript}...
        </span>
      )}
    </div>
  );
}
