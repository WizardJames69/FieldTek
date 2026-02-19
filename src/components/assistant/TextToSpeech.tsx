import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TextToSpeechProps {
  text: string;
  disabled?: boolean;
}

// Standalone function to play TTS audio
export async function playTTS(text: string): Promise<void> {
  if (!text.trim()) return;

  const { data, error } = await supabase.functions.invoke("elevenlabs-tts", {
    body: { text },
  });

  if (error) throw error;
  if (!data?.audioContent) throw new Error("No audio received");

  const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
  const audio = new Audio(audioUrl);
  await audio.play();
}

export function TextToSpeech({ text, disabled }: TextToSpeechProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    if (!text.trim()) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-tts", {
        body: { text },
      });

      if (error) throw error;
      if (!data?.audioContent) throw new Error("No audio received");

      // Use data URI for playback
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        toast.error("Failed to play audio");
      };

      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("TTS error:", error);
      toast.error("Failed to generate speech");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={handlePlay}
      disabled={disabled || isLoading || !text.trim()}
      title={isPlaying ? "Stop" : "Read aloud"}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isPlaying ? (
        <VolumeX className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
