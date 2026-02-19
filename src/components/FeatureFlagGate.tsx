import { ReactNode } from 'react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

interface FeatureFlagGateProps {
  /** The feature flag key to check */
  flag: string;
  /** Content to render when the flag is enabled */
  children: ReactNode;
  /** Optional content to render when the flag is disabled */
  fallback?: ReactNode;
  /** If true, shows a loading skeleton while flags are loading */
  showLoading?: boolean;
}

/**
 * Conditionally renders children based on feature flag status.
 * 
 * @example
 * // Simple usage - show content only when flag is enabled
 * <FeatureFlagGate flag="new_calendar_ui">
 *   <NewCalendar />
 * </FeatureFlagGate>
 * 
 * @example
 * // With fallback - show alternative when flag is disabled
 * <FeatureFlagGate flag="ai_suggestions" fallback={<ManualSuggestions />}>
 *   <AISuggestions />
 * </FeatureFlagGate>
 */
export function FeatureFlagGate({ 
  flag, 
  children, 
  fallback = null,
  showLoading = false 
}: FeatureFlagGateProps) {
  const { isEnabled, isLoading } = useFeatureFlags();

  if (isLoading) {
    if (showLoading) {
      return (
        <div className="animate-pulse bg-muted rounded h-8 w-full" />
      );
    }
    return null;
  }

  if (isEnabled(flag)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
