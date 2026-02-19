import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Play, SkipForward, Loader2, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  DEMO_TOUR_STEPS as RAW_TOUR_STEPS, 
  getResolvedTourStep,
  type TourStep 
} from '@/config/demoTourConfig';
import { IndustryType } from '@/config/industryTerminology';


// Layout constants for safe positioning
const BANNER_HEIGHT = 44;
const HEADER_HEIGHT = 64;
const FAB_HEIGHT = 80;
const SAFE_MARGIN = 16;
const TOTAL_TOP_OFFSET = BANNER_HEIGHT + HEADER_HEIGHT + SAFE_MARGIN;

// Breakpoints
const TABLET_BREAKPOINT = 1024;
const MOBILE_BREAKPOINT = 640;

// Resolved step type (after industry interpolation)
export interface ResolvedTourStep {
  id: string;
  target: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  page: string;
  action?: 'click' | 'highlight' | 'interactive';
  interactiveHint?: string;
}

// Re-export for backwards compatibility
export type { TourStep };
export { RAW_TOUR_STEPS as DEMO_TOUR_STEPS };

interface DemoTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  industry?: IndustryType;
  initialStepIndex?: number;
  onStepChange?: (stepIndex: number) => void;
}

export function DemoTour({ 
  isOpen, 
  onClose, 
  onComplete,
  industry = 'general',
  initialStepIndex = 0,
  onStepChange,
}: DemoTourProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionToken = searchParams.get('session');
  
  // Resolve tour steps with industry-specific text
  const resolvedSteps = useMemo(() => 
    RAW_TOUR_STEPS.map(step => getResolvedTourStep(step, industry)),
    [industry]
  );
  
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const lastRectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 5;

  // Track tooltip zone for mobile/tablet
  const [tooltipZone, setTooltipZone] = useState<'top' | 'bottom'>('bottom');

  // Guard against invalid step index
  const currentStep = resolvedSteps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / resolvedSteps.length) * 100;

  // Notify parent of step changes
  useEffect(() => {
    onStepChange?.(currentStepIndex);
  }, [currentStepIndex, onStepChange]);

  // On mobile/tablet, skip tour entirely — let users roam freely
  useEffect(() => {
    if (!isOpen) return;
    const isMobileView = typeof window !== 'undefined' && window.innerWidth < TABLET_BREAKPOINT;
    if (isMobileView) {
      onComplete();
      onClose();
    }
  }, [isOpen, onComplete, onClose]);

  // Early return if step is invalid
  useEffect(() => {
    if (!currentStep && isOpen) {
      onComplete();
      onClose();
    }
  }, [currentStep, isOpen, onComplete, onClose]);

  // Navigate to step's page if needed
  const navigateToStep = useCallback((step: ResolvedTourStep) => {
    if (!step) return;
    const currentPath = window.location.pathname;
    if (currentPath !== step.page) {
      setIsTransitioning(true);
      // Scroll to top before navigating to prevent leftover scroll positions
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      navigate(`${step.page}?session=${sessionToken}`);
      // Longer timeout to ensure page fully renders
      setTimeout(() => setIsTransitioning(false), 800);
    }
  }, [navigate, sessionToken]);

  // Find and highlight target element with throttled updates and retry logic
  useEffect(() => {
    if (!isOpen || !currentStep || isTransitioning) return;

    // Reset retry count when step changes
    retryCountRef.current = 0;

    const findTargetWithRetry = () => {
      const target = document.querySelector(currentStep.target);
      if (target) {
        retryCountRef.current = 0; // Reset on success
        const rect = target.getBoundingClientRect();
        
        // Only update if rect changed significantly (throttle flashing)
        const lastRect = lastRectRef.current;
        const threshold = 5;
        const hasChanged = !lastRect || 
          Math.abs(rect.top - lastRect.top) > threshold ||
          Math.abs(rect.left - lastRect.left) > threshold ||
          Math.abs(rect.width - lastRect.width) > threshold ||
          Math.abs(rect.height - lastRect.height) > threshold;
        
        if (hasChanged) {
          lastRectRef.current = rect;
          setTargetRect(rect);
          
          // For mobile and tablet, determine zone based on target position
          const isMobileOrTablet = window.innerWidth < TABLET_BREAKPOINT;
          if (isMobileOrTablet) {
            const targetCenterY = rect.top + rect.height / 2;
            const viewportMidpoint = window.innerHeight / 2;
            const placeTooltipAtTop = targetCenterY > viewportMidpoint;
            setTooltipZone(placeTooltipAtTop ? 'top' : 'bottom');
            
            // Custom scroll calculation that accounts for fixed header and tooltip
            const elementTop = rect.top + window.scrollY;
            const tooltipHeight = 220; // Approximate tooltip height
            const padding = 32; // Visual breathing room
            
            let scrollTarget: number;
            
            if (placeTooltipAtTop) {
              // Tooltip at top means target is in bottom half
              // Scroll so element appears in lower portion, leaving room for tooltip above
              scrollTarget = elementTop - tooltipHeight - TOTAL_TOP_OFFSET - padding;
            } else {
              // Tooltip at bottom means target is in top half
              // Scroll element below the header with padding, tooltip will appear below
              scrollTarget = elementTop - TOTAL_TOP_OFFSET - padding;
            }
            
            // Clamp to valid scroll range
            scrollTarget = Math.max(0, scrollTarget);
            
            window.scrollTo({
              top: scrollTarget,
              behavior: 'smooth'
            });
          } else {
            // Desktop: for tall elements, scroll to top instead of center
            const isTallElement = rect.height > window.innerHeight * 0.6;
            if (isTallElement) {
              const elementTop = rect.top + window.scrollY;
              window.scrollTo({ 
                top: Math.max(0, elementTop - TOTAL_TOP_OFFSET - 16), 
                behavior: 'smooth' 
              });
            } else {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }
      } else if (retryCountRef.current < maxRetries) {
        // Retry finding element with exponential backoff
        retryCountRef.current++;
        setTimeout(findTargetWithRetry, 200 * retryCountRef.current);
      } else {
        // Give up after max retries - show tooltip centered without target
        console.warn(`Tour: Could not find target ${currentStep.target} after ${maxRetries} retries`);
        setTargetRect(null);
      }
    };

    // Navigate to correct page first
    navigateToStep(currentStep);

    // Give DOM more time to render after navigation
    const timer = setTimeout(findTargetWithRetry, isTransitioning ? 800 : 300);
    
    // Throttled scroll/resize handler using RAF
    const handleUpdate = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        // Only update if we already found the target
        if (targetRect) {
          const target = document.querySelector(currentStep.target);
          if (target) {
            const rect = target.getBoundingClientRect();
            lastRectRef.current = rect;
            setTargetRect(rect);
          }
        }
        rafRef.current = null;
      });
    };

    window.addEventListener('resize', handleUpdate, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleUpdate);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isOpen, currentStep, currentStepIndex, isTransitioning, navigateToStep]);

  // Reset lastRectRef when step changes
  useEffect(() => {
    lastRectRef.current = null;
  }, [currentStepIndex]);

  const handleNext = () => {
    if (isNavigating) return; // Prevent rapid clicks during transition
    
    if (currentStepIndex < resolvedSteps.length - 1) {
      setIsNavigating(true);
      setCurrentStepIndex(currentStepIndex + 1);
      setTimeout(() => setIsNavigating(false), 600);
    } else {
      onComplete();
      onClose();
    }
  };

  const handlePrev = () => {
    if (isNavigating) return; // Prevent rapid clicks during transition
    
    if (currentStepIndex > 0) {
      setIsNavigating(true);
      setCurrentStepIndex(currentStepIndex - 1);
      setTimeout(() => setIsNavigating(false), 600);
    }
  };

  const handleSkip = () => {
    onComplete();
    onClose();
  };


  if (!isOpen || !currentStep) return null;

  // Detect viewport type
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const isMobile = viewportWidth < MOBILE_BREAKPOINT;
  const isTablet = viewportWidth >= MOBILE_BREAKPOINT && viewportWidth < TABLET_BREAKPOINT;
  const isMobileOrTablet = viewportWidth < TABLET_BREAKPOINT;

  // Calculate best position based on available space
  const calculateBestPosition = (rect: DOMRect, tooltipWidth: number, tooltipHeight: number): 'top' | 'bottom' | 'left' | 'right' => {
    const availableSpace = {
      top: rect.top - TOTAL_TOP_OFFSET,
      bottom: window.innerHeight - rect.bottom - FAB_HEIGHT - SAFE_MARGIN,
      left: rect.left - SAFE_MARGIN,
      right: window.innerWidth - rect.right - SAFE_MARGIN,
    };

    // Calculate which positions have enough space
    const canFitTop = availableSpace.top >= tooltipHeight + SAFE_MARGIN;
    const canFitBottom = availableSpace.bottom >= tooltipHeight + SAFE_MARGIN;
    const canFitLeft = availableSpace.left >= tooltipWidth + SAFE_MARGIN;
    const canFitRight = availableSpace.right >= tooltipWidth + SAFE_MARGIN;

    // Priority: bottom > right > left > top (prefer bottom for readability)
    if (canFitBottom) return 'bottom';
    if (canFitRight) return 'right';
    if (canFitLeft) return 'left';
    if (canFitTop) return 'top';

    // Fallback: choose direction with most space
    const maxSpace = Math.max(availableSpace.top, availableSpace.bottom, availableSpace.left, availableSpace.right);
    if (maxSpace === availableSpace.bottom) return 'bottom';
    if (maxSpace === availableSpace.right) return 'right';
    if (maxSpace === availableSpace.left) return 'left';
    return 'top';
  };

  // Calculate tooltip position with smart viewport detection
  const getTooltipPosition = (): React.CSSProperties => {
    const baseTooltipWidth = isMobile ? 280 : isTablet ? 300 : 320;
    const tooltipHeight = isMobile ? 180 : isTablet ? 200 : 240;
    const offset = isMobileOrTablet ? 24 : 16; // Increased offset for mobile/tablet
    const safeMargin = isMobile ? 12 : isTablet ? 16 : SAFE_MARGIN;

    // Default centered position when no target
    if (!targetRect) {
      return { 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        maxWidth: `calc(100vw - ${safeMargin * 2}px)`,
      };
    }

    // For mobile AND tablet - use fixed zone-based positioning
    if (isMobileOrTablet) {
      if (tooltipZone === 'top') {
        // Target is in bottom half, place tooltip at top (below banner + header)
        return {
          position: 'fixed',
          top: TOTAL_TOP_OFFSET,
          left: safeMargin,
          right: safeMargin,
          maxWidth: `calc(100vw - ${safeMargin * 2}px)`,
          width: 'auto',
        };
      } else {
        // Target is in top half, place tooltip at bottom with generous margin
        // Ensure at least 140px from bottom to avoid clipping
        const bottomMargin = Math.max(FAB_HEIGHT + SAFE_MARGIN + 40, 140);
        return {
          position: 'fixed',
          bottom: bottomMargin,
          left: safeMargin,
          right: safeMargin,
          maxWidth: `calc(100vw - ${safeMargin * 2}px)`,
          width: 'auto',
        };
      }
    }

    const tooltipWidth = baseTooltipWidth;

    // Determine effective position - use auto-positioning or respect specified position with smart fallbacks
    let effectivePosition: 'top' | 'bottom' | 'left' | 'right';
    
    if (currentStep.position === 'auto') {
      effectivePosition = calculateBestPosition(targetRect, tooltipWidth, tooltipHeight);
    } else {
      effectivePosition = currentStep.position as 'top' | 'bottom' | 'left' | 'right';
      
      // Smart fallback: check if specified position would cause cropping
      const availableSpace = {
        top: targetRect.top - TOTAL_TOP_OFFSET,
        bottom: window.innerHeight - targetRect.bottom - FAB_HEIGHT - SAFE_MARGIN,
        left: targetRect.left - SAFE_MARGIN,
        right: window.innerWidth - targetRect.right - SAFE_MARGIN,
      };

      // Check if current position has enough space, otherwise find best alternative
      const needsFallback = 
        (effectivePosition === 'top' && availableSpace.top < tooltipHeight + SAFE_MARGIN) ||
        (effectivePosition === 'bottom' && availableSpace.bottom < tooltipHeight + SAFE_MARGIN) ||
        (effectivePosition === 'left' && availableSpace.left < tooltipWidth + SAFE_MARGIN) ||
        (effectivePosition === 'right' && availableSpace.right < tooltipWidth + SAFE_MARGIN);

      if (needsFallback) {
        effectivePosition = calculateBestPosition(targetRect, tooltipWidth, tooltipHeight);
      }
    }

    // Calculate safe boundaries
    const minTop = TOTAL_TOP_OFFSET;
    const maxTop = window.innerHeight - tooltipHeight - FAB_HEIGHT - SAFE_MARGIN;
    const minLeft = safeMargin;
    const maxLeft = window.innerWidth - tooltipWidth - safeMargin;

    let style: React.CSSProperties = {
      maxWidth: Math.min(tooltipWidth, window.innerWidth - safeMargin * 2),
      maxHeight: `calc(100vh - ${TOTAL_TOP_OFFSET + FAB_HEIGHT + SAFE_MARGIN * 2}px)`,
      overflowY: 'auto',
    };

    switch (effectivePosition) {
      case 'top':
        style = {
          ...style,
          bottom: Math.max(
            FAB_HEIGHT + SAFE_MARGIN,
            window.innerHeight - targetRect.top + offset
          ),
          left: Math.max(minLeft, Math.min(
            targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
            maxLeft
          )),
        };
        break;
      case 'bottom':
        style = {
          ...style,
          top: Math.max(minTop, Math.min(
            targetRect.bottom + offset,
            maxTop
          )),
          left: Math.max(minLeft, Math.min(
            targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
            maxLeft
          )),
        };
        break;
      case 'left':
        style = {
          ...style,
          top: Math.max(minTop, Math.min(
            targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
            maxTop
          )),
          right: Math.max(
            safeMargin,
            window.innerWidth - targetRect.left + offset
          ),
        };
        break;
      case 'right':
        style = {
          ...style,
          top: Math.max(minTop, Math.min(
            targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
            maxTop
          )),
          left: Math.min(
            targetRect.right + offset,
            maxLeft
          ),
        };
        break;
    }

    return style;
  };

  // Determine effective position for arrow (must match getTooltipPosition logic)
  const getEffectivePosition = (): 'top' | 'bottom' | 'left' | 'right' => {
    if (!targetRect) return 'bottom';
    
    const tooltipWidth = 320;
    const tooltipHeight = 240;
    
    if (currentStep.position === 'auto') {
      return calculateBestPosition(targetRect, tooltipWidth, tooltipHeight);
    }
    
    let effectivePosition = currentStep.position as 'top' | 'bottom' | 'left' | 'right';
    
    const availableSpace = {
      top: targetRect.top - TOTAL_TOP_OFFSET,
      bottom: window.innerHeight - targetRect.bottom - FAB_HEIGHT - SAFE_MARGIN,
      left: targetRect.left - SAFE_MARGIN,
      right: window.innerWidth - targetRect.right - SAFE_MARGIN,
    };

    const needsFallback = 
      (effectivePosition === 'top' && availableSpace.top < tooltipHeight + SAFE_MARGIN) ||
      (effectivePosition === 'bottom' && availableSpace.bottom < tooltipHeight + SAFE_MARGIN) ||
      (effectivePosition === 'left' && availableSpace.left < tooltipWidth + SAFE_MARGIN) ||
      (effectivePosition === 'right' && availableSpace.right < tooltipWidth + SAFE_MARGIN);

    if (needsFallback) {
      return calculateBestPosition(targetRect, tooltipWidth, tooltipHeight);
    }
    
    return effectivePosition;
  };

  // Determine arrow position based on effective tooltip position
  const getArrowClasses = () => {
    // Hide arrow on mobile/tablet since tooltip is fixed at top/bottom
    if (isMobileOrTablet) return 'hidden';
    if (!targetRect) return 'hidden';

    const effectivePosition = getEffectivePosition();

    switch (effectivePosition) {
      case 'top':
        return 'bottom-[-8px] left-1/2 -translate-x-1/2 border-t-0 border-l-0';
      case 'bottom':
        return 'top-[-8px] left-1/2 -translate-x-1/2 border-b-0 border-r-0';
      case 'left':
        return 'right-[-8px] top-10 border-l-0 border-b-0';
      case 'right':
        return 'left-[-8px] top-10 border-r-0 border-t-0';
      default:
        return 'hidden';
    }
  };

  // Get skip button position based on device
  const getSkipButtonPosition = () => {
    if (isMobile) {
      return "top-[116px] right-3";
    } else if (isTablet) {
      return "top-[116px] right-4";
    } else {
      return "bottom-6 right-6";
    }
  };

  return createPortal(
    <>
      {/* Loading overlay during page transitions */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            key="loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10002] bg-black/60 flex items-center justify-center"
          >
            <div className="text-white text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading next step...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Main tour content - ALWAYS rendered, never removed during transitions */}
      <div className="fixed inset-0 z-[9999] pointer-events-none">
        {/* Backdrop with spotlight cutout - only render when target is found */}
        {targetRect && (
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <mask id="spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <motion.rect
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  x={targetRect.left - 8}
                  y={targetRect.top - 8}
                  width={targetRect.width + 16}
                  height={targetRect.height + 16}
                  rx="8"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.75)"
              mask="url(#spotlight-mask)"
            />
          </svg>
        )}

        {/* Highlight ring around target */}
        {targetRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute"
            style={{
              left: targetRect.left - 8,
              top: targetRect.top - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
          >
            <div className="w-full h-full rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse" />
          </motion.div>
        )}

        {/* Tooltip - STABLE key, content transitions inside */}
        <motion.div
          key="tour-tooltip"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ 
            opacity: isNavigating ? 0.7 : 1, 
            scale: isNavigating ? 0.98 : 1 
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={cn(
            "fixed z-[10000] pointer-events-auto touch-manipulation",
            isMobileOrTablet ? "w-auto" : "w-80"
          )}
          style={getTooltipPosition()}
        >
          <div className="bg-popover border-2 border-primary/20 rounded-xl shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto">
            {/* Progress bar */}
            <div className="h-1 bg-muted">
              <Progress value={progress} className="h-1 rounded-none" />
            </div>
            
            {/* Content with AnimatePresence for smooth step transitions */}
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentStep.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "p-3 sm:p-4 md:p-5",
                  isTablet && "p-4" // Compact padding for tablet
                )}
              >
                {/* Header with close */}
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <h4 className={cn(
                    "font-semibold pr-3",
                    isMobile ? "text-sm" : isTablet ? "text-sm" : "text-base"
                  )}>
                    {currentStep.title}
                  </h4>
                  <button
                    onClick={handleSkip}
                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 p-1 -mr-1 -mt-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Description */}
                <p className={cn(
                  "text-muted-foreground mb-3 leading-relaxed",
                  isMobile ? "text-xs mb-2" : isTablet ? "text-xs mb-3" : "text-sm mb-4"
                )}>
                  {currentStep.description}
                </p>

                {/* Swipe hint - only on first step and mobile */}
                {isMobile && currentStepIndex === 0 && (
                  <div className="flex items-center justify-center gap-2 mb-3 py-2 px-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-1">
                      <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                      <div className="w-6 h-1 bg-muted-foreground/40 rounded-full" />
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Swipe to navigate</span>
                  </div>
                )}

                {/* Navigation - stacked on mobile/tablet for easier tapping */}
                <div className={cn(
                  "flex gap-2",
                  isMobileOrTablet ? "flex-col" : "items-center justify-between"
                )}>
                  <span className={cn(
                    "text-xs text-muted-foreground",
                    isMobileOrTablet && "text-center mb-1"
                  )}>
                    Step {currentStepIndex + 1} of {resolvedSteps.length}
                  </span>
                  <div className={cn(
                    "flex gap-2",
                    isMobileOrTablet ? "w-full" : "flex-shrink-0"
                  )}>
                    {currentStepIndex > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handlePrev}
                        disabled={isNavigating}
                        className={cn(
                          "h-9",
                          isMobileOrTablet ? "flex-1" : "px-3"
                        )}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleNext}
                      disabled={isNavigating}
                      className={cn(
                        "h-9",
                        isMobileOrTablet ? "flex-1" : "px-4"
                      )}
                    >
                      {currentStepIndex === resolvedSteps.length - 1 ? (
                        'Finish'
                      ) : (
                        <>
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Arrow pointing to target - hidden on mobile/tablet */}
          {targetRect && !isMobileOrTablet && (
            <div
              className={cn(
                'absolute w-4 h-4 bg-popover border-2 border-primary/20 rotate-45',
                getArrowClasses()
              )}
            />
          )}
        </motion.div>

        {/* Skip button - pointer-events-auto */}
        <button
          onClick={handleSkip}
          className={cn(
            "fixed z-[10001] pointer-events-auto flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-background/80 backdrop-blur-sm border rounded-full text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors",
            getSkipButtonPosition()
          )}
        >
          <SkipForward className="h-3 w-3 sm:h-4 sm:w-4" />
          Skip
        </button>
      </div>
    </>,
    document.body
  );
}

// Start Tour Button Component
export function StartTourButton({ onStart }: { onStart: () => void }) {
  return (
    <Button
      onClick={onStart}
      size="sm"
      variant="outline"
      className="gap-2 border-primary/30 hover:border-primary hover:bg-primary/5"
    >
      <Play className="h-4 w-4" />
      Start Guided Tour
    </Button>
  );
}
