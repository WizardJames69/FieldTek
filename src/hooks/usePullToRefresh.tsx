import { useState, useRef, useCallback, useEffect } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

interface UsePullToRefreshReturn {
  isRefreshing: boolean;
  pullProgress: number;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  containerStyle: React.CSSProperties;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isPulling = useRef(false);

  const pullProgress = Math.min(pullDistance / threshold, 1);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    // Only enable pull-to-refresh if we're at the top of the scroll container
    const target = e.currentTarget as HTMLElement;
    if (target.scrollTop > 0) return;
    
    startY.current = e.touches[0].clientY;
    isPulling.current = true;
  }, [disabled, isRefreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || disabled || isRefreshing) return;
    
    currentY.current = e.touches[0].clientY;
    const distance = currentY.current - startY.current;
    
    // Only track downward pulls
    if (distance > 0) {
      // Apply resistance to make it feel natural
      const resistedDistance = Math.min(distance * 0.5, threshold * 1.5);
      setPullDistance(resistedDistance);
    }
  }, [disabled, isRefreshing, threshold]);

  const onTouchEnd = useCallback(async () => {
    if (!isPulling.current || disabled) return;
    
    isPulling.current = false;
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.6); // Keep a small pull while refreshing
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, isRefreshing, onRefresh, pullDistance, threshold]);

  // Reset state when disabled changes
  useEffect(() => {
    if (disabled) {
      setPullDistance(0);
      isPulling.current = false;
    }
  }, [disabled]);

  const containerStyle: React.CSSProperties = {
    transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
    transition: isPulling.current ? 'none' : 'transform 0.2s ease-out',
  };

  return {
    isRefreshing,
    pullProgress,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    containerStyle,
  };
}
