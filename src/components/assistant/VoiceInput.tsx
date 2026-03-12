import { useState, useCallback, useRef, useEffect } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  /** Auto-stop recording after this many milliseconds */
  maxDurationMs?: number;
}

export function VoiceInput({ onTranscript, disabled = false, maxDurationMs }: VoiceInputProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const clearAutoTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => clearAutoTimeout, [clearAutoTimeout]);

  const handleToggle = useCallback(async () => {
    if (scribe.isConnected) {
      clearAutoTimeout();
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

      // Start auto-timeout if configured
      if (maxDurationMs) {
        clearAutoTimeout();
        timeoutRef.current = setTimeout(() => {
          scribe.disconnect();
          setCurrentTranscript("");
        }, maxDurationMs);
      }
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
  }, [scribe, onTranscript, maxDurationMs, clearAutoTimeout]);

  const isRecording = scribe.isConnected;

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={isRecording ? "destructive" : "ghost"}
        size="icon"
        className={cn(
          "h-12 w-12 transition-all",
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
        <span className="text-sm text-muted-foreground italic truncate max-w-[200px]">
          {currentTranscript}...
        </span>
      )}
    </div>
  );
}
