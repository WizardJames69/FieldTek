import React, { Component, ErrorInfo, ReactNode, useState } from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, Check, Bug, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { captureError, getSessionId, getBreadcrumbs, type CapturedError } from '@/lib/errorTracking';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
  capturedError: CapturedError | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorId: null,
    capturedError: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Capture error with full context
    const captured = captureError(error, {
      severity: 'fatal',
      componentStack: errorInfo.componentStack || undefined,
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
    
    this.setState({ 
      errorId: captured.id,
      capturedError: captured,
    });
    
    // Call optional callback
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorId: null, capturedError: null });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallbackUI
          error={this.state.error}
          errorId={this.state.errorId}
          capturedError={this.state.capturedError}
          onRetry={this.handleRetry}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}

// Separate UI component for the error fallback
interface ErrorFallbackUIProps {
  error: Error | null;
  errorId: string | null;
  capturedError: CapturedError | null;
  onRetry: () => void;
  onGoHome: () => void;
}

function ErrorFallbackUI({ error, errorId, capturedError, onRetry, onGoHome }: ErrorFallbackUIProps) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(false);
  
  const sessionId = getSessionId();
  const breadcrumbs = getBreadcrumbs().slice(-10);
  
  const handleCopyErrorId = async () => {
    const text = `Error ID: ${errorId}\nSession: ${sessionId}\nURL: ${window.location.href}\nTime: ${new Date().toISOString()}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  const handleReportIssue = async () => {
    setReporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Fallback to mailto if not logged in
        const subject = encodeURIComponent(`Bug Report: ${errorId}`);
        const body = encodeURIComponent(`Error ID: ${errorId}\nURL: ${window.location.href}\nError: ${error?.message || 'Unknown'}`);
        window.open(`mailto:support@fieldtek.ai?subject=${subject}&body=${body}`, '_blank');
        return;
      }

      // Get tenant_id from tenant_users
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      await supabase.from('beta_feedback').insert({
        user_id: user.id,
        tenant_id: tenantUser?.tenant_id || null,
        feedback_type: 'bug',
        urgency: 'high',
        title: `Crash Report: ${error?.name || 'Error'} — ${errorId}`,
        description: [
          `**Error ID:** ${errorId}`,
          `**Session:** ${sessionId}`,
          `**URL:** ${window.location.href}`,
          `**Time:** ${new Date().toISOString()}`,
          `**Error:** ${error?.message || 'Unknown'}`,
          error?.stack ? `\n**Stack:**\n\`\`\`\n${error.stack.split('\n').slice(0, 8).join('\n')}\n\`\`\`` : '',
        ].join('\n'),
        page_context: window.location.pathname,
      });

      setReported(true);
    } catch (e) {
      console.error('Failed to submit bug report:', e);
      // Fallback
      const subject = encodeURIComponent(`Bug Report: ${errorId}`);
      window.open(`mailto:support@fieldtek.ai?subject=${subject}`, '_blank');
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <Card className="max-w-lg w-full dialog-glass">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            An unexpected error occurred. Please try again or return to the home page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error ID Badge */}
          {errorId && (
            <div className="flex items-center justify-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                Error ID: {errorId}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopyErrorId}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          )}
          
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs font-mono text-muted-foreground break-all">
                {error.message}
              </p>
            </div>
          )}
          
          {/* Technical Details (Collapsible) */}
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="text-xs text-muted-foreground">Technical Details</span>
                {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              <div className="p-3 bg-muted/50 rounded-lg text-xs font-mono space-y-1">
                <p><span className="text-muted-foreground">Name:</span> {error?.name}</p>
                <p><span className="text-muted-foreground">Session:</span> {sessionId}</p>
                <p><span className="text-muted-foreground">URL:</span> {window.location.pathname}</p>
                <p><span className="text-muted-foreground">Time:</span> {new Date().toLocaleString()}</p>
                {capturedError?.fingerprint && (
                  <p><span className="text-muted-foreground">Fingerprint:</span> {capturedError.fingerprint}</p>
                )}
              </div>
              
              {/* Stack trace */}
              {error?.stack && (
                <div className="p-3 bg-muted/30 rounded-lg max-h-32 overflow-auto">
                  <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                    {error.stack.split('\n').slice(0, 6).join('\n')}
                  </pre>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
          
          {/* Breadcrumbs (Collapsible) */}
          {breadcrumbs.length > 0 && (
            <Collapsible open={showBreadcrumbs} onOpenChange={setShowBreadcrumbs}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span className="text-xs text-muted-foreground">Recent Activity ({breadcrumbs.length})</span>
                  {showBreadcrumbs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="p-3 bg-muted/30 rounded-lg max-h-40 overflow-auto space-y-1">
                  {breadcrumbs.map((crumb, i) => (
                    <div key={i} className="text-[10px] font-mono flex items-start gap-2">
                      <span className="text-muted-foreground shrink-0">
                        {new Date(crumb.timestamp).toLocaleTimeString()}
                      </span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                        {crumb.type}
                      </Badge>
                      <span className="text-foreground/80 break-all">
                        {crumb.message}
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onGoHome}
            >
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
            <Button
              className="flex-1"
              onClick={onRetry}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
          
          {/* Report Issue Button */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={handleReportIssue}
            disabled={reporting || reported}
          >
            {reporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : reported ? (
              <Check className="mr-2 h-4 w-4 text-green-500" />
            ) : (
              <Bug className="mr-2 h-4 w-4" />
            )}
            {reported ? 'Bug report sent!' : reporting ? 'Sending...' : 'Report this issue'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Functional wrapper for easier use with hooks
interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <ErrorFallbackUI
      error={error}
      errorId={null}
      capturedError={null}
      onRetry={resetErrorBoundary}
      onGoHome={() => { window.location.href = '/'; }}
    />
  );
}
