import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Eye, EyeOff, Rocket, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDemoSandbox } from '@/contexts/DemoSandboxContext';
import { cn } from '@/lib/utils';

export function DemoModeBanner() {
  const navigate = useNavigate();
  const { showTooltips, setShowTooltips, checklistProgress, endDemoSession } = useDemoSandbox();
  const [isMinimized, setIsMinimized] = useState(false);

  const handleStartTrial = () => {
    endDemoSession();
    navigate('/register');
  };

  const handleBackHome = () => {
    endDemoSession();
    navigate('/');
  };

  if (isMinimized) {
    return (
      <div className="fixed top-16 right-4 z-40 flex items-center gap-2">
        <Button
          size="icon"
          variant="secondary"
          className="shadow-lg h-9 w-9"
          onClick={handleBackHome}
          aria-label="Back to home"
        >
          <Home className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="shadow-lg"
          onClick={() => setIsMinimized(false)}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Demo Mode
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="sticky top-0 z-40 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md"
      data-demo-banner
    >
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between py-2 gap-2 sm:gap-4">
          {/* Left side - Demo mode indicator */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="font-medium text-xs sm:text-sm whitespace-nowrap">Demo Mode</span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-primary-foreground/30 flex-shrink-0" />
            <span className="hidden sm:block text-sm opacity-90 truncate">
              Exploring with sample data
            </span>
          </div>

          {/* Progress indicator - hidden on small mobile */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <div className="w-24 h-1.5 bg-primary-foreground/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-foreground rounded-full transition-all duration-500"
                style={{ width: `${checklistProgress}%` }}
              />
            </div>
            <span className="text-xs opacity-75 whitespace-nowrap">
              {Math.round(checklistProgress)}% explored
            </span>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Back to Home button */}
            <Button
              size="sm"
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10 h-8 px-2"
              onClick={handleBackHome}
            >
              <Home className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline text-xs">Home</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10 hidden sm:flex h-8 px-2"
              onClick={() => setShowTooltips(!showTooltips)}
            >
              {showTooltips ? (
                <>
                  <EyeOff className="h-3.5 w-3.5 mr-1" />
                  <span className="text-xs">Hide Tips</span>
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  <span className="text-xs">Show Tips</span>
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90 h-8 px-2 sm:px-3"
              onClick={handleStartTrial}
            >
              <Rocket className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline text-xs sm:text-sm">Join Waitlist</span>
              <span className="sm:hidden text-xs">Join</span>
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 sm:h-8 sm:w-8 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 flex-shrink-0"
              onClick={() => setIsMinimized(true)}
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
