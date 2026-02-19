import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for trapping focus within a container (e.g., modals, dialogs)
 * This complements Radix UI's built-in focus management with additional control
 */
export function useFocusTrap(isActive: boolean = true) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    
    const focusableSelectors = [
      'button:not([disabled]):not([aria-hidden="true"])',
      'a[href]:not([disabled]):not([aria-hidden="true"])',
      'input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"])',
      'select:not([disabled]):not([aria-hidden="true"])',
      'textarea:not([disabled]):not([aria-hidden="true"])',
      '[tabindex]:not([tabindex="-1"]):not([disabled]):not([aria-hidden="true"])',
      '[contenteditable]:not([aria-hidden="true"])',
    ].join(', ');

    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter((el) => {
      // Additional check for visibility
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isActive || event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement;

      // Shift + Tab on first element -> move to last
      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
      // Tab on last element -> move to first
      else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    },
    [isActive, getFocusableElements]
  );

  // Store previous focus and set initial focus
  useEffect(() => {
    if (isActive) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Focus the first focusable element after a short delay
      const timeoutId = setTimeout(() => {
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [isActive, getFocusableElements]);

  // Restore focus on cleanup
  useEffect(() => {
    return () => {
      if (previousActiveElement.current && isActive) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive]);

  // Add keyboard listener
  useEffect(() => {
    if (isActive) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isActive, handleKeyDown]);

  return {
    containerRef,
    focusFirst: () => {
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    },
    focusLast: () => {
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[focusableElements.length - 1].focus();
      }
    },
  };
}

/**
 * Hook for managing roving tabindex in list-like components
 * Enables arrow key navigation within a group of items
 */
export function useRovingTabIndex<T extends HTMLElement>(
  itemCount: number,
  orientation: 'horizontal' | 'vertical' | 'both' = 'vertical'
) {
  const containerRef = useRef<T>(null);
  const currentIndexRef = useRef(0);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const isVertical = orientation === 'vertical' || orientation === 'both';
      const isHorizontal = orientation === 'horizontal' || orientation === 'both';

      let nextIndex = currentIndexRef.current;

      switch (event.key) {
        case 'ArrowDown':
          if (isVertical) {
            event.preventDefault();
            nextIndex = Math.min(currentIndexRef.current + 1, itemCount - 1);
          }
          break;
        case 'ArrowUp':
          if (isVertical) {
            event.preventDefault();
            nextIndex = Math.max(currentIndexRef.current - 1, 0);
          }
          break;
        case 'ArrowRight':
          if (isHorizontal) {
            event.preventDefault();
            nextIndex = Math.min(currentIndexRef.current + 1, itemCount - 1);
          }
          break;
        case 'ArrowLeft':
          if (isHorizontal) {
            event.preventDefault();
            nextIndex = Math.max(currentIndexRef.current - 1, 0);
          }
          break;
        case 'Home':
          event.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          nextIndex = itemCount - 1;
          break;
        default:
          return;
      }

      if (nextIndex !== currentIndexRef.current) {
        currentIndexRef.current = nextIndex;
        
        // Focus the new item
        const items = containerRef.current?.querySelectorAll<HTMLElement>(
          '[data-roving-item]'
        );
        items?.[nextIndex]?.focus();
      }
    },
    [itemCount, orientation]
  );

  const getItemProps = useCallback(
    (index: number) => ({
      'data-roving-item': true,
      tabIndex: index === currentIndexRef.current ? 0 : -1,
      onFocus: () => {
        currentIndexRef.current = index;
      },
    }),
    []
  );

  return {
    containerRef,
    containerProps: {
      role: 'listbox',
      'aria-orientation': orientation === 'both' ? undefined : orientation,
      onKeyDown: handleKeyDown,
    },
    getItemProps,
    setActiveIndex: (index: number) => {
      currentIndexRef.current = index;
    },
  };
}
