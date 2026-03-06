import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { demoScript, type DemoScriptItem } from "@/data/demoScript";
import { AnimatedEyebrow } from "./AnimatedEyebrow";
import { ScrollReveal } from "./ScrollReveal";

/**
 * Self-contained dark-themed narrated demo player for the landing page.
 * Uses ElevenLabs TTS via the generate-demo-audio edge function.
 * No auto-play — user must click to start.
 */
export function DemoWalkthroughSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [audioProgress, setAudioProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const cacheRef = useRef<Map<number, string>>(new Map());

  // Fetch audio for a scene
  const fetchAudio = useCallback(async (item: DemoScriptItem): Promise<string | null> => {
    if (cacheRef.current.has(item.sceneId)) {
      return cacheRef.current.get(item.sceneId)!;
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-demo-audio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: item.transcript, sceneId: item.sceneId }),
        }
      );

      if (!res.ok) throw new Error("Audio fetch failed");
      const data = await res.json();

      const url = data.audioUrl || (data.audioContent ? `data:audio/mpeg;base64,${data.audioContent}` : null);
      if (url) cacheRef.current.set(item.sceneId, url);
      return url;
    } catch (err) {
      console.error("[DemoWalkthrough] Audio error:", err);
      return null;
    }
  }, []);

  // Play a specific scene
  const playScene = useCallback(async (idx: number) => {
    if (idx >= demoScript.length) {
      playingRef.current = false;
      setIsPlaying(false);
      setIsPaused(false);
      setTranscript("");
      setAudioProgress(0);
      return;
    }

    const item = demoScript[idx];
    setCurrentIndex(idx);
    setTranscript(item.transcript);

    setIsLoading(true);
    const url = await fetchAudio(item);
    setIsLoading(false);

    if (!playingRef.current) return;

    // Preload next scene
    if (idx + 1 < demoScript.length && !cacheRef.current.has(demoScript[idx + 1].sceneId)) {
      fetchAudio(demoScript[idx + 1]);
    }

    if (url && audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.muted = isMuted;
      try {
        await audioRef.current.play();
      } catch {
        // Fallback: advance after 3s
        setTimeout(() => {
          if (playingRef.current && !isPaused) playScene(idx + 1);
        }, 3000);
      }
    } else {
      setTimeout(() => {
        if (playingRef.current && !isPaused) playScene(idx + 1);
      }, 3000);
    }
  }, [fetchAudio, isMuted, isPaused]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (playingRef.current && !isPaused) {
        setTimeout(() => {
          if (playingRef.current && !isPaused) playScene(currentIndex + 1);
        }, 500);
      }
    };

    const onTimeUpdate = () => {
      if (audio.duration) setAudioProgress((audio.currentTime / audio.duration) * 100);
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [currentIndex, isPaused, playScene]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted;
  }, [isMuted]);

  const handlePlay = () => {
    if (isPaused) {
      setIsPaused(false);
      audioRef.current?.play().catch(() => {});
      return;
    }
    setIsPlaying(true);
    setIsPaused(false);
    playingRef.current = true;
    playScene(0);
  };

  const handlePause = () => {
    setIsPaused(true);
    audioRef.current?.pause();
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAudioProgress(0);
    setCurrentIndex(0);
    setTranscript("");
    if (isPlaying) {
      setIsPaused(false);
      playScene(0);
    }
  };

  const overallProgress = ((currentIndex + audioProgress / 100) / demoScript.length) * 100;

  return (
    <section className="bg-[#0C0D0F] py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <AnimatedEyebrow label="Product Tour" center colorClass="text-orange-500" />
          <ScrollReveal delay={0.05}>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2">
              See FieldTek in action
            </h2>
            <p className="text-sm text-zinc-500">
              A 60-second narrated walkthrough of the platform
            </p>
          </ScrollReveal>
        </div>

        {/* Player card */}
        <ScrollReveal delay={0.1}>
          <div className="rounded-2xl border border-white/[0.06] bg-[#111214] p-5 md:p-6">
            <audio ref={audioRef} />

            {/* Scene indicator + progress */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {isPlaying && !isPaused && (
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                )}
                <span className="text-xs font-medium text-zinc-400">
                  {isPlaying ? `Scene ${currentIndex + 1} / ${demoScript.length}` : "Narrated Demo"}
                </span>
              </div>
              {isPlaying && (
                <span className="text-[10px] text-zinc-600 font-mono">
                  {Math.round(overallProgress)}%
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden mb-4">
              <motion.div
                className="h-full bg-orange-500 rounded-full"
                animate={{ width: `${isPlaying ? overallProgress : 0}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>

            {/* Scene dots */}
            <div className="flex justify-center gap-1.5 mb-4">
              {demoScript.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentIndex && isPlaying
                      ? "w-5 bg-orange-500"
                      : i < currentIndex && isPlaying
                        ? "w-1.5 bg-orange-500/40"
                        : "w-1.5 bg-white/[0.08]"
                  }`}
                />
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 mb-4">
              {!isPlaying ? (
                <button
                  onClick={handlePlay}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {isLoading ? "Loading..." : "Play Demo"}
                </button>
              ) : (
                <>
                  <button
                    onClick={isPaused ? handlePlay : handlePause}
                    className="h-9 w-9 flex items-center justify-center rounded-lg border border-white/[0.1] text-zinc-400 hover:text-white hover:border-white/[0.2] transition-colors"
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleRestart}
                    className="h-9 w-9 flex items-center justify-center rounded-lg border border-white/[0.1] text-zinc-400 hover:text-white hover:border-white/[0.2] transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </>
              )}
            </div>

            {/* Transcript / captions */}
            {isPlaying && transcript && (
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-white/[0.03] rounded-lg p-3"
              >
                <p className="text-xs text-zinc-500 leading-relaxed">{transcript}</p>
              </motion.div>
            )}

            {/* Loading state for audio */}
            {isLoading && isPlaying && (
              <div className="flex items-center justify-center gap-2 mt-3 text-xs text-zinc-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Generating audio...</span>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
