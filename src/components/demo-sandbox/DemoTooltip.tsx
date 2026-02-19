import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDemoSandbox } from '@/contexts/DemoSandboxContext';
import { cn } from '@/lib/utils';

// Layout constants for safe positioning
const BANNER_HEIGHT = 44;
const HEADER_HEIGHT = 64;
const FAB_HEIGHT = 80;
const SAFE_MARGIN = 16;
const TOTAL_TOP_OFFSET = BANNER_HEIGHT + HEADER_HEIGHT + SAFE_MARGIN;

interface TooltipPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export function DemoTooltipOverlay() {
  const {
    showTooltips,
    getTooltipsForPage,
    currentTooltipIndex,
    setCurrentTooltipIndex,
    setShowTooltips,
  } = useDemoSandbox();

  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const rafRef = useRef<number | null>(null);
  const lastPositionRef = useRef<TooltipPosition | null>(null);

  const tooltips = getTooltipsForPage(currentPath);
  const currentTooltip = tooltips[currentTooltipIndex];

  useEffect(() => {
    // Update path when it changes
    const handlePathChange = () => {
      setCurrentPath(window.location.pathname);
      setCurrentTooltipIndex(0); // Reset to first tooltip on page change
    };

    window.addEventListener('popstate', handlePathChange);
    return () => window.removeEventListener('popstate', handlePathChange);
  }, [setCurrentTooltipIndex]);

  // Calculate best position based on available space
  const calculateBestPosition = (rect: DOMRect, tooltipWidth: number, tooltipHeight: number): 'top' | 'bottom' | 'left' | 'right' => {
    const availableSpace = {
      top: rect.top - TOTAL_TOP_OFFSET,
      bottom: window.innerHeight - rect.bottom - FAB_HEIGHT - SAFE_MARGIN,
      left: rect.left - SAFE_MARGIN,
      right: window.innerWidth - rect.right - SAFE_MARGIN,
    };

    // Priority: bottom > right > left > top
    if (availableSpace.bottom >= tooltipHeight + SAFE_MARGIN) return 'bottom';
    if (availableSpace.right >= tooltipWidth + SAFE_MARGIN) return 'right';
    if (availableSpace.left >= tooltipWidth + SAFE_MARGIN) return 'left';
    if (availableSpace.top >= tooltipHeight + SAFE_MARGIN) return 'top';

    // Fallback: choose direction with most space
    const maxSpace = Math.max(availableSpace.top, availableSpace.bottom, availableSpace.left, availableSpace.right);
    if (maxSpace === availableSpace.bottom) return 'bottom';
    if (maxSpace === availableSpace.right) return 'right';
    if (maxSpace === availableSpace.left) return 'left';
    return 'top';
  };

  const updatePosition = useCallback(() => {
    if (!showTooltips || !currentTooltip) {
      setPosition(null);
      return;
    }

    const targetElement = document.querySelector(currentTooltip.target);
    if (!targetElement) {
      setPosition(null);
      return;
    }

    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = 280;
    const tooltipHeight = 140;
    const offset = 12;
    const isMobile = window.innerWidth < 640;
    const safeMargin = isMobile ? 12 : SAFE_MARGIN;

    let newPosition: TooltipPosition = {};
    
    // On mobile, use fixed positioning to avoid cropping
    if (isMobile) {
      const targetCenterY = rect.top + rect.height / 2;
      const viewportMidpoint = window.innerHeight / 2;
      
      if (targetCenterY > viewportMidpoint) {
        // Target is in bottom half, place tooltip at top
        newPosition = {
          top: TOTAL_TOP_OFFSET,
          left: safeMargin,
          right: safeMargin,
        };
      } else {
        // Target is in top half, place tooltip at bottom
        newPosition = {
          bottom: FAB_HEIGHT + SAFE_MARGIN,
          left: safeMargin,
          right: safeMargin,
        };
      }
    } else {
      // Desktop: use smart positioning
      const preferredPosition = currentTooltip.position as 'top' | 'bottom' | 'left' | 'right';
      
      // Check if preferred position has enough space
      const availableSpace = {
        top: rect.top - TOTAL_TOP_OFFSET,
        bottom: window.innerHeight - rect.bottom - FAB_HEIGHT - SAFE_MARGIN,
        left: rect.left - SAFE_MARGIN,
        right: window.innerWidth - rect.right - SAFE_MARGIN,
      };

      const needsFallback = 
        (preferredPosition === 'top' && availableSpace.top < tooltipHeight + SAFE_MARGIN) ||
        (preferredPosition === 'bottom' && availableSpace.bottom < tooltipHeight + SAFE_MARGIN) ||
        (preferredPosition === 'left' && availableSpace.left < tooltipWidth + SAFE_MARGIN) ||
        (preferredPosition === 'right' && availableSpace.right < tooltipWidth + SAFE_MARGIN);

      const effectivePosition = needsFallback 
        ? calculateBestPosition(rect, tooltipWidth, tooltipHeight)
        : preferredPosition;

      // Calculate safe boundaries
      const minTop = TOTAL_TOP_OFFSET;
      const maxTop = window.innerHeight - tooltipHeight - FAB_HEIGHT - SAFE_MARGIN;
      const minLeft = safeMargin;
      const maxLeft = window.innerWidth - tooltipWidth - safeMargin;

      switch (effectivePosition) {
        case 'top':
          newPosition = {
            bottom: Math.max(FAB_HEIGHT + SAFE_MARGIN, window.innerHeight - rect.top + offset),
            left: Math.max(minLeft, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, maxLeft)),
          };
          break;
        case 'bottom':
          newPosition = {
            top: Math.max(minTop, Math.min(rect.bottom + offset, maxTop)),
            left: Math.max(minLeft, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, maxLeft)),
          };
          break;
        case 'left':
          newPosition = {
            top: Math.max(minTop, Math.min(rect.top + rect.height / 2 - tooltipHeight / 2, maxTop)),
            right: Math.max(safeMargin, window.innerWidth - rect.left + offset),
          };
          break;
        case 'right':
          newPosition = {
            top: Math.max(minTop, Math.min(rect.top + rect.height / 2 - tooltipHeight / 2, maxTop)),
            left: Math.min(rect.right + offset, maxLeft),
          };
          break;
      }
    }

    // Only update if position changed significantly
    const lastPos = lastPositionRef.current;
    const threshold = 3;
    const hasChanged = !lastPos ||
      Math.abs((newPosition.top ?? 0) - (lastPos.top ?? 0)) > threshold ||
      Math.abs((newPosition.left ?? 0) - (lastPos.left ?? 0)) > threshold ||
      Math.abs((newPosition.bottom ?? 0) - (lastPos.bottom ?? 0)) > threshold ||
      Math.abs((newPosition.right ?? 0) - (lastPos.right ?? 0)) > threshold;

    if (hasChanged) {
      lastPositionRef.current = newPosition;
      setPosition(newPosition);
    }
  }, [showTooltips, currentTooltip]);

  useEffect(() => {
    if (!showTooltips || !currentTooltip) {
      setPosition(null);
      return;
    }

    updatePosition();
    
    // Throttled resize handler
    const handleResize = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        updatePosition();
        rafRef.current = null;
      });
    };

    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [showTooltips, currentTooltip, updatePosition]);

  // Reset position ref when tooltip changes
  useEffect(() => {
    lastPositionRef.current = null;
  }, [currentTooltipIndex]);

  if (!showTooltips || !currentTooltip || !position) {
    return null;
  }

  const hasNext = currentTooltipIndex < tooltips.length - 1;
  const hasPrev = currentTooltipIndex > 0;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key={currentTooltip.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn(
          "fixed z-[100] touch-manipulation",
          isMobile ? "left-3 right-3" : "w-[280px]"
        )}
        style={position}
      >
        <div className="bg-popover border rounded-lg shadow-xl p-4">
          {/* Close button */}
          <button
            onClick={() => setShowTooltips(false)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Content */}
          <h4 className="font-semibold text-sm mb-1 pr-6">{currentTooltip.title}</h4>
          <p className="text-sm text-muted-foreground mb-3">
            {currentTooltip.description}
          </p>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {currentTooltipIndex + 1} of {tooltips.length}
            </span>
            <div className="flex gap-1">
              {hasPrev && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => setCurrentTooltipIndex(currentTooltipIndex - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              {hasNext ? (
                <Button
                  size="sm"
                  className="h-7"
                  onClick={() => setCurrentTooltipIndex(currentTooltipIndex + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-7"
                  onClick={() => setShowTooltips(false)}
                >
                  Got it!
                </Button>
              )}
            </div>
          </div>

          {/* Arrow - hidden on mobile */}
          {!isMobile && (
            <div
              className={cn(
                'absolute w-3 h-3 bg-popover border rotate-45',
                (currentTooltip.position as string) === 'top' && 'bottom-[-6px] left-1/2 -translate-x-1/2 border-t-0 border-l-0',
                (currentTooltip.position as string) === 'bottom' && 'top-[-6px] left-1/2 -translate-x-1/2 border-b-0 border-r-0',
                (currentTooltip.position as string) === 'left' && 'right-[-6px] top-1/2 -translate-y-1/2 border-l-0 border-b-0',
                (currentTooltip.position as string) === 'right' && 'left-[-6px] top-1/2 -translate-y-1/2 border-r-0 border-t-0'
              )}
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
