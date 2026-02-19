import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PlayCircle, CheckCircle2 } from 'lucide-react';
import { useTutorialByFeature, useTutorialProgress, formatDuration } from '@/hooks/useTutorialProgress';
import { TutorialVideoDialog } from './TutorialVideoDialog';

interface ContextualTutorialBadgeProps {
  featureKey: string;
  variant?: 'badge' | 'button' | 'icon';
  className?: string;
}

export function ContextualTutorialBadge({
  featureKey,
  variant = 'badge',
  className,
}: ContextualTutorialBadgeProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: tutorial, isLoading } = useTutorialByFeature(featureKey);
  const { data: progress } = useTutorialProgress();

  if (isLoading || !tutorial) return null;

  const tutorialProgress = progress?.find(p => p.tutorial_id === tutorial.id);
  const isCompleted = tutorialProgress?.completed || false;

  const handleClick = () => {
    setDialogOpen(true);
  };

  if (variant === 'icon') {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={className}
                onClick={handleClick}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <PlayCircle className="h-4 w-4 text-primary" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isCompleted ? 'Tutorial completed' : `Watch: ${tutorial.title}`}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TutorialVideoDialog
          tutorial={tutorial}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </>
    );
  }

  if (variant === 'button') {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className={className}
          onClick={handleClick}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
          ) : (
            <PlayCircle className="h-4 w-4 mr-1" />
          )}
          {isCompleted ? 'Rewatch Tutorial' : 'Watch Tutorial'}
          <span className="ml-1 text-muted-foreground">
            ({formatDuration(tutorial.duration_seconds)})
          </span>
        </Button>
        <TutorialVideoDialog
          tutorial={tutorial}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </>
    );
  }

  // Default: badge variant
  return (
    <>
      <Badge
        variant={isCompleted ? 'secondary' : 'default'}
        className={`cursor-pointer hover:opacity-80 transition-opacity ${className}`}
        onClick={handleClick}
      >
        {isCompleted ? (
          <CheckCircle2 className="h-3 w-3 mr-1" />
        ) : (
          <PlayCircle className="h-3 w-3 mr-1" />
        )}
        {isCompleted ? 'Watched' : 'Tutorial'}
      </Badge>
      <TutorialVideoDialog
        tutorial={tutorial}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
