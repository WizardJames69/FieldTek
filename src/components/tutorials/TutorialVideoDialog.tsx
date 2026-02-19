import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, CheckCircle, Clock } from 'lucide-react';
import { Tutorial, useMarkTutorialWatched, formatDuration, TUTORIAL_CATEGORIES } from '@/hooks/useTutorialProgress';

interface TutorialVideoDialogProps {
  tutorial: Tutorial | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function TutorialVideoDialog({
  tutorial,
  open,
  onOpenChange,
  onComplete,
}: TutorialVideoDialogProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [watchTime, setWatchTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const markWatched = useMarkTutorialWatched();

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setWatchTime(0);
    }
  }, [open]);

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setWatchTime(Math.floor(videoRef.current.currentTime));
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (tutorial) {
      markWatched.mutate({
        tutorialId: tutorial.id,
        completed: true,
        watchDuration: tutorial.duration_seconds,
      });
      onComplete?.();
    }
  };

  const handleMarkComplete = () => {
    if (tutorial) {
      markWatched.mutate({
        tutorialId: tutorial.id,
        completed: true,
        watchDuration: watchTime,
      });
      onOpenChange(false);
      onComplete?.();
    }
  };

  if (!tutorial) return null;

  const hasVideo = !!tutorial.video_url;
  const categoryLabel = TUTORIAL_CATEGORIES[tutorial.category] || tutorial.category;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary">{categoryLabel}</Badge>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(tutorial.duration_seconds)}
            </span>
          </div>
          <DialogTitle className="text-xl">{tutorial.title}</DialogTitle>
          {tutorial.description && (
            <DialogDescription>{tutorial.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="mt-4">
          {hasVideo ? (
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                src={tutorial.video_url!}
                poster={tutorial.thumbnail_url || undefined}
                className="w-full h-full object-cover"
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                controls
              />
            </div>
          ) : (
            <div className="aspect-video bg-gradient-to-br from-muted/80 via-muted/40 to-background rounded-xl flex flex-col items-center justify-center border border-border/40 relative overflow-hidden">
              {/* Subtle background glow */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
              </div>
              
              {/* Content */}
              <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center">
                {/* Play button icon */}
                <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Play className="h-7 w-7 text-primary ml-0.5" />
                </div>
                
                <div className="space-y-1.5">
                  <p className="font-semibold text-foreground">Video Coming Soon</p>
                  <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                    We're recording this tutorial. Review the details and mark as reviewed to track progress.
                  </p>
                </div>

                {tutorial.description && (
                  <div className="mt-1 p-4 bg-card rounded-xl border border-border/60 max-w-sm w-full text-left">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">What you'll learn</p>
                    <p className="text-sm text-foreground leading-relaxed">{tutorial.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            {watchTime > 0 && (
              <span>Watched: {formatDuration(watchTime)}</span>
            )}
          </div>
          <div className="flex gap-2">
            {hasVideo ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={isPlaying ? handlePause : handlePlay}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-4 w-4 mr-1" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      Play
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={handleMarkComplete}
                  disabled={markWatched.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark Complete
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleMarkComplete}
                disabled={markWatched.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Mark as Reviewed
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
