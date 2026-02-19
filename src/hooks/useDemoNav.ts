import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Hook for navigating within the demo sandbox while preserving the session token.
 * This ensures users don't get kicked out when clicking navigation buttons.
 */
export function useDemoNav() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get session token from URL
  const sessionToken = searchParams.get('session');

  /**
   * Build a demo path with the session token appended
   */
  const getDemoPath = useCallback((path: string): string => {
    if (!sessionToken) {
      console.warn('[useDemoNav] No session token available');
      return path;
    }
    
    // Handle paths that already have query params
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}session=${sessionToken}`;
  }, [sessionToken]);

  /**
   * Navigate to a demo path while preserving the session token
   */
  const navigateDemo = useCallback((path: string) => {
    const fullPath = getDemoPath(path);
    console.log('[useDemoNav] navigating to:', fullPath);
    navigate(fullPath);
  }, [navigate, getDemoPath]);

  return {
    navigateDemo,
    getDemoPath,
    sessionToken,
  };
}
