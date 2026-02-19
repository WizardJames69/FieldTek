import { useState, useEffect, useRef, useCallback, memo, forwardRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Loader2, Calendar, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { demoScript, DemoScriptItem } from '@/data/demoScript';
import { LeadCaptureModal } from './LeadCaptureModal';
import { supabase } from '@/integrations/supabase/client';

interface ScriptedDemoPlayerProps {
  onSceneChange: (sceneId: number) => void;
  onPlayingChange?: (isPlaying: boolean) => void;
  compact?: boolean;
}

export const ScriptedDemoPlayer = memo(forwardRef<HTMLDivElement, ScriptedDemoPlayerProps>(function ScriptedDemoPlayer({
  onSceneChange,
  onPlayingChange,
  compact = false
}, ref) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioCache, setAudioCache] = useState<Map<number, string>>(new Map());
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [audioProgress, setAudioProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);

  // Get or generate audio for a scene - checks storage first, then generates
  const getAudioForScene = useCallback(async (item: DemoScriptItem): Promise<string | null> => {
    // Check local cache first
    if (audioCache.has(item.sceneId)) {
      console.log('[ScriptedDemo] Local cache hit for scene', item.sceneId);
      return audioCache.get(item.sceneId)!;
    }
    
    try {
      console.log('[ScriptedDemo] Fetching audio for scene', item.sceneId);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-demo-audio`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            text: item.transcript,
            sceneId: item.sceneId 
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get audio');
      }

      const data = await response.json();
      
      // Check if we got a storage URL or base64 fallback
      let audioUrl: string;
      if (data.audioUrl) {
        // Got a cached URL from storage
        audioUrl = data.audioUrl;
        console.log('[ScriptedDemo] Storage cache hit:', data.cached ? 'yes' : 'newly cached');
      } else if (data.audioContent) {
        // Fallback to base64
        audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
        console.log('[ScriptedDemo] Using base64 fallback');
      } else {
        throw new Error('No audio data received');
      }
      
      // Cache locally
      setAudioCache(prev => new Map(prev).set(item.sceneId, audioUrl));
      
      return audioUrl;
    } catch (error) {
      console.error('Error getting audio for scene', item.sceneId, error);
      return null;
    }
  }, [audioCache]);

  // Pre-generate next scene audio in background
  const preloadNextScene = useCallback(async (currentIndex: number) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < demoScript.length) {
      const nextItem = demoScript[nextIndex];
      if (!audioCache.has(nextItem.sceneId)) {
        console.log('[ScriptedDemo] Preloading scene', nextItem.sceneId);
        await getAudioForScene(nextItem);
      }
    }
  }, [audioCache, getAudioForScene]);

  // Handle lead form submission
  const handleLeadSubmit = async (data: { name: string; email: string; phone?: string; company?: string }) => {
    const { error } = await supabase.from('demo_requests').insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      company_name: data.company || null,
      status: 'new',
      message: 'Submitted after watching demo'
    });
    
    if (error) {
      console.error('Error saving lead:', error);
      throw error;
    }
  };

  // Play a specific scene
  const playScene = useCallback(async (sceneIndex: number) => {
    if (sceneIndex >= demoScript.length) {
      // Demo complete - show completion state
      console.log('[ScriptedDemo] Demo complete');
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentTranscript('');
      setAudioProgress(0);
      setIsComplete(true);
      isPlayingRef.current = false;
      onPlayingChange?.(false);
      return;
    }

    const item = demoScript[sceneIndex];
    console.log('[ScriptedDemo] Playing scene', sceneIndex, item.sceneId);
    
    setCurrentSceneIndex(sceneIndex);
    setCurrentTranscript(item.transcript);
    onSceneChange(item.sceneId);
    
    // Get audio (from cache/storage or generate new)
    setIsLoading(true);
    const audioUrl = await getAudioForScene(item);
    setIsLoading(false);
    
    if (!isPlayingRef.current) {
      // User stopped while loading
      return;
    }
    
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.muted = isMuted;
      try {
        await audioRef.current.play();
        // Preload next scene in background
        preloadNextScene(sceneIndex);
      } catch (e) {
        console.error('Audio playback failed:', e);
        // Still advance to next scene after a delay
        setTimeout(() => {
          if (isPlayingRef.current && !isPaused) {
            playScene(sceneIndex + 1);
          }
        }, 3000);
      }
    } else {
      // No audio, advance after delay
      setTimeout(() => {
        if (isPlayingRef.current && !isPaused) {
          playScene(sceneIndex + 1);
        }
      }, 3000);
    }
  }, [getAudioForScene, isMuted, isPaused, onPlayingChange, onSceneChange, preloadNextScene]);

  // Handle audio ended - advance to next scene
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      console.log('[ScriptedDemo] Audio ended, advancing to next scene');
      if (isPlayingRef.current && !isPaused) {
        // Small delay before next scene for natural pacing
        setTimeout(() => {
          if (isPlayingRef.current && !isPaused) {
            playScene(currentSceneIndex + 1);
          }
        }, 500);
      }
    };

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [currentSceneIndex, isPaused, playScene]);

  // Handle mute changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handlePlay = async () => {
    if (isPaused) {
      setIsPaused(false);
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
      return;
    }
    
    // Start fresh
    setIsPlaying(true);
    setIsPaused(false);
    isPlayingRef.current = true;
    onPlayingChange?.(true);
    
    // Play first scene
    playScene(0);
  };

  const handlePause = () => {
    setIsPaused(true);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAudioProgress(0);
    setIsComplete(false);
    
    if (isPlaying) {
      setIsPaused(false);
      playScene(0);
    } else {
      setCurrentSceneIndex(0);
      setCurrentTranscript('');
    }
  };

  const handleBookDemo = () => {
    setShowLeadModal(true);
  };

  const handleWatchAgain = () => {
    setIsComplete(false);
    setCurrentSceneIndex(0);
    handlePlay();
  };

  const handleStop = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSceneIndex(0);
    setCurrentTranscript('');
    setAudioProgress(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    onPlayingChange?.(false);
  };

  // Calculate overall progress
  const overallProgress = ((currentSceneIndex + (audioProgress / 100)) / demoScript.length) * 100;

  const formatSceneProgress = () => {
    return `${currentSceneIndex + 1} / ${demoScript.length}`;
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <audio ref={audioRef} />
        
        {/* Compact Controls */}
        <div className="flex items-center gap-2">
          {!isPlaying ? (
            <Button
              onClick={handlePlay}
              disabled={isLoading}
              size="sm"
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Watch Demo
            </Button>
          ) : (
            <>
              <Button
                onClick={isPaused ? handlePlay : handlePause}
                size="sm"
                variant="outline"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </Button>
              <Button
                onClick={handleRestart}
                size="sm"
                variant="outline"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setIsMuted(!isMuted)}
                size="sm"
                variant="ghost"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">
                Scene {formatSceneProgress()}
              </span>
            </>
          )}
        </div>
        
        {isPlaying && (
          <Progress value={overallProgress} className="h-1" />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="bg-card border rounded-xl p-4 space-y-4">
        <audio ref={audioRef} />
        
        <AnimatePresence mode="wait">
          {isComplete ? (
            // Demo Complete State with CTA
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-4 text-center space-y-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15, delay: 0.1 }}
                className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <Sparkles className="w-6 h-6 text-primary" />
              </motion.div>
              
              <div>
                <h3 className="font-semibold text-lg">Thanks for Watching!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Ready to see how FieldTek can transform your operations?
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  onClick={handleBookDemo}
                  className="flex-1"
                  size="lg"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Book a Demo
                </Button>
                <Button
                  onClick={handleWatchAgain}
                  variant="outline"
                  className="flex-1"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Watch Again
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="player"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isPlaying && !isPaused && (
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                  <span className="text-sm font-medium">Pre-Recorded Demo</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Scene {formatSceneProgress()}
                </span>
              </div>
              
              {/* Progress */}
              <div className="space-y-2">
                <Progress value={overallProgress} className="h-2" />
                <div className="flex justify-between">
                  {demoScript.map((item, index) => (
                    <div
                      key={item.sceneId}
                      className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                        index < currentSceneIndex 
                          ? 'bg-primary' 
                          : index === currentSceneIndex 
                            ? 'bg-primary animate-pulse' 
                            : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
              </div>
              
              {/* Controls */}
              <div className="flex items-center gap-2">
                {!isPlaying ? (
                  <Button
                    onClick={handlePlay}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Watch Demo
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={isPaused ? handlePlay : handlePause}
                      variant="outline"
                      size="icon"
                    >
                      {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </Button>
                    <Button
                      onClick={handleRestart}
                      variant="outline"
                      size="icon"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => setIsMuted(!isMuted)}
                      variant="ghost"
                      size="icon"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                    <Button
                      onClick={handleStop}
                      variant="destructive"
                      size="sm"
                      className="ml-auto"
                    >
                      End
                    </Button>
                  </>
                )}
              </div>
              
              {/* Transcript / Captions */}
              {isPlaying && currentTranscript && (
                <div className="bg-muted/50 rounded-lg p-3 transition-opacity duration-300">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {currentTranscript}
                  </p>
                </div>
              )}
              
              {/* Loading indicator for next scene */}
              {isLoading && isPlaying && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading audio...</span>
                </div>
              )}
              
              {/* Scene indicator */}
              {isPlaying && (
                <div className="flex items-center justify-center gap-1">
                  {demoScript.map((item, index) => (
                    <div
                      key={item.sceneId}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        index === currentSceneIndex 
                          ? 'w-6 bg-primary' 
                          : index < currentSceneIndex 
                            ? 'w-2 bg-primary/50' 
                            : 'w-2 bg-muted'
                      }`}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Lead Capture Modal */}
      <LeadCaptureModal
        open={showLeadModal}
        onOpenChange={setShowLeadModal}
        onSubmit={handleLeadSubmit}
      />
    </>
  );
}));

export default ScriptedDemoPlayer;
