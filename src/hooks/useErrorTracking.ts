import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  addBreadcrumb, 
  setUser, 
  captureError, 
  createScope,
  trackPerformance,
  type CapturedError 
} from '@/lib/errorTracking';

/**
 * Hook to track navigation breadcrumbs
 */
export function useNavigationTracking(): void {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      addBreadcrumb({
        type: 'navigation',
        category: 'router',
        message: `Route changed: ${prevPathRef.current} → ${location.pathname}`,
        data: {
          from: prevPathRef.current,
          to: location.pathname,
          search: location.search,
        },
      });
      prevPathRef.current = location.pathname;
    }
  }, [location]);
}

/**
 * Hook to set user context for error tracking
 */
export function useUserTracking(userId?: string, tenantId?: string): void {
  useEffect(() => {
    setUser(userId, tenantId);
    return () => setUser(undefined, undefined);
  }, [userId, tenantId]);
}

/**
 * Hook to capture errors with additional context
 */
export function useErrorCapture(scopeName?: string) {
  const scope = scopeName ? createScope(scopeName) : null;
  
  const capture = useCallback((error: Error, extra?: Record<string, unknown>) => {
    if (scope) {
      scope.captureError(error, extra);
    } else {
      captureError(error, { extra });
    }
  }, [scope]);
  
  const breadcrumb = useCallback((
    type: 'navigation' | 'click' | 'network' | 'user' | 'state',
    category: string,
    message: string,
    data?: Record<string, unknown>
  ) => {
    if (scope) {
      scope.addBreadcrumb({ type, category, message, data });
    } else {
      addBreadcrumb({ type, category, message, data });
    }
  }, [scope]);
  
  return { capture, breadcrumb };
}

/**
 * Hook for performance tracking
 */
export function usePerformanceTracking(operationName: string) {
  const startTime = useRef<number>(0);
  
  const startTracking = useCallback(() => {
    startTime.current = performance.now();
  }, []);
  
  const endTracking = useCallback((metadata?: Record<string, unknown>) => {
    if (startTime.current > 0) {
      const duration = performance.now() - startTime.current;
      trackPerformance(operationName, duration, metadata);
      startTime.current = 0;
      return duration;
    }
    return 0;
  }, [operationName]);
  
  return { startTracking, endTracking };
}

/**
 * Hook to track async operations with error capture
 */
export function useAsyncErrorCapture() {
  const capture = useCallback(async <T>(
    operation: () => Promise<T>,
    context: { name: string; extra?: Record<string, unknown> }
  ): Promise<T> => {
    const startTime = performance.now();
    
    addBreadcrumb({
      type: 'state',
      category: 'async',
      message: `Starting: ${context.name}`,
    });
    
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      
      addBreadcrumb({
        type: 'state',
        category: 'async',
        message: `Completed: ${context.name} (${duration.toFixed(0)}ms)`,
        level: 'info',
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      captureError(error as Error, {
        extra: {
          operationName: context.name,
          duration,
          ...context.extra,
        },
      });
      
      throw error;
    }
  }, []);
  
  return capture;
}

export type { CapturedError };
