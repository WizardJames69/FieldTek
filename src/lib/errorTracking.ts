/**
 * Error Tracking & Monitoring System
 * 
 * Provides structured error capture, breadcrumbs, and sanitization
 * for production monitoring without external dependencies.
 */

// Environment detection
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// PII patterns to sanitize
const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card
  /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, // SSN
];

// Maximum breadcrumbs to retain
const MAX_BREADCRUMBS = 50;

// Error severity levels
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

// Breadcrumb types
export type BreadcrumbType = 
  | 'navigation' 
  | 'click' 
  | 'network' 
  | 'console' 
  | 'error' 
  | 'user' 
  | 'state';

// Breadcrumb entry
export interface Breadcrumb {
  timestamp: string;
  type: BreadcrumbType;
  category: string;
  message: string;
  data?: Record<string, unknown>;
  level?: 'debug' | 'info' | 'warning' | 'error';
}

// Error context
export interface ErrorContext {
  errorId: string;
  timestamp: string;
  url: string;
  userAgent: string;
  viewport: { width: number; height: number };
  memoryUsage?: number;
  connectionType?: string;
  userId?: string;
  tenantId?: string;
  sessionId: string;
  breadcrumbs: Breadcrumb[];
  tags: Record<string, string>;
  extra: Record<string, unknown>;
}

// Captured error
export interface CapturedError {
  id: string;
  name: string;
  message: string;
  stack?: string;
  componentStack?: string;
  severity: ErrorSeverity;
  context: ErrorContext;
  fingerprint: string;
}

// Session ID for grouping errors
const sessionId = generateErrorId();

// Breadcrumb store
let breadcrumbs: Breadcrumb[] = [];

// User context
let userContext: { userId?: string; tenantId?: string } = {};

// Custom tags
let globalTags: Record<string, string> = {};

// Error callbacks
const errorCallbacks: ((error: CapturedError) => void)[] = [];

/**
 * Generate a unique error ID
 */
export function generateErrorId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomPart}`.toUpperCase();
}

/**
 * Sanitize PII from strings
 */
export function sanitizePII(input: string): string {
  let sanitized = input;
  PII_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });
  return sanitized;
}

/**
 * Sanitize an object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive keys
    if (/password|secret|token|key|auth|credential/i.test(key)) {
      result[key] = '[REDACTED]';
      continue;
    }
    
    if (typeof value === 'string') {
      result[key] = sanitizePII(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  
  return result as T;
}

/**
 * Generate error fingerprint for deduplication
 */
function generateFingerprint(error: Error, componentStack?: string): string {
  const parts = [
    error.name,
    error.message.substring(0, 100),
    error.stack?.split('\n')[1]?.trim() || '',
    componentStack?.split('\n')[1]?.trim() || '',
  ];
  
  // Simple hash
  const str = parts.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).toUpperCase();
}

/**
 * Get current error context
 */
function getContext(): ErrorContext {
  const nav = navigator as Navigator & { 
    connection?: { effectiveType?: string };
    deviceMemory?: number;
  };
  
  return {
    errorId: generateErrorId(),
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    memoryUsage: nav.deviceMemory,
    connectionType: nav.connection?.effectiveType,
    userId: userContext.userId,
    tenantId: userContext.tenantId,
    sessionId,
    breadcrumbs: [...breadcrumbs],
    tags: { ...globalTags },
    extra: {},
  };
}

/**
 * Add a breadcrumb
 */
export function addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
  const entry: Breadcrumb = {
    ...breadcrumb,
    timestamp: new Date().toISOString(),
    message: sanitizePII(breadcrumb.message),
    data: breadcrumb.data ? sanitizeObject(breadcrumb.data as Record<string, unknown>) : undefined,
  };
  
  breadcrumbs.push(entry);
  
  // Trim old breadcrumbs
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs = breadcrumbs.slice(-MAX_BREADCRUMBS);
  }
}

/**
 * Set user context
 */
export function setUser(userId?: string, tenantId?: string): void {
  userContext = { userId, tenantId };
  addBreadcrumb({
    type: 'user',
    category: 'auth',
    message: userId ? 'User identified' : 'User cleared',
  });
}

/**
 * Set global tags
 */
export function setTags(tags: Record<string, string>): void {
  globalTags = { ...globalTags, ...tags };
}

/**
 * Clear user context
 */
export function clearUser(): void {
  userContext = {};
}

/**
 * Register error callback
 */
export function onError(callback: (error: CapturedError) => void): () => void {
  errorCallbacks.push(callback);
  return () => {
    const index = errorCallbacks.indexOf(callback);
    if (index > -1) errorCallbacks.splice(index, 1);
  };
}

/**
 * Capture an error
 */
export function captureError(
  error: Error,
  options: {
    severity?: ErrorSeverity;
    componentStack?: string;
    extra?: Record<string, unknown>;
    tags?: Record<string, string>;
  } = {}
): CapturedError {
  const { 
    severity = 'error', 
    componentStack, 
    extra = {}, 
    tags = {} 
  } = options;
  
  const context = getContext();
  context.extra = sanitizeObject(extra);
  context.tags = { ...context.tags, ...tags };
  
  const captured: CapturedError = {
    id: context.errorId,
    name: error.name,
    message: sanitizePII(error.message),
    stack: error.stack ? sanitizePII(error.stack) : undefined,
    componentStack: componentStack ? sanitizePII(componentStack) : undefined,
    severity,
    context,
    fingerprint: generateFingerprint(error, componentStack),
  };
  
  // Log in development
  if (isDevelopment) {
    console.group(`🔴 [ErrorTracking] ${captured.id}`);
    console.error('Error:', error);
    console.log('Context:', captured.context);
    console.log('Breadcrumbs:', captured.context.breadcrumbs.slice(-10));
    console.groupEnd();
  }
  
  // Production logging (structured)
  if (isProduction) {
    console.error('[ErrorTracking]', JSON.stringify({
      id: captured.id,
      name: captured.name,
      message: captured.message,
      severity: captured.severity,
      fingerprint: captured.fingerprint,
      url: captured.context.url,
      timestamp: captured.context.timestamp,
    }));
  }
  
  // Add error breadcrumb
  addBreadcrumb({
    type: 'error',
    category: 'exception',
    message: `${error.name}: ${error.message}`,
    level: 'error',
  });
  
  // Notify callbacks
  errorCallbacks.forEach(cb => {
    try {
      cb(captured);
    } catch (e) {
      console.error('[ErrorTracking] Callback error:', e);
    }
  });
  
  return captured;
}

/**
 * Capture a message (non-error)
 */
export function captureMessage(
  message: string,
  severity: ErrorSeverity = 'info',
  extra?: Record<string, unknown>
): void {
  const error = new Error(message);
  error.name = 'Message';
  captureError(error, { severity, extra });
}

/**
 * Wrap a function with error capture
 */
export function withErrorCapture<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options?: { name?: string; extra?: Record<string, unknown> }
): T {
  return ((...args: unknown[]) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((error: Error) => {
          captureError(error, { 
            extra: { 
              functionName: options?.name || fn.name, 
              ...options?.extra 
            } 
          });
          throw error;
        });
      }
      return result;
    } catch (error) {
      captureError(error as Error, { 
        extra: { 
          functionName: options?.name || fn.name, 
          ...options?.extra 
        } 
      });
      throw error;
    }
  }) as T;
}

/**
 * Initialize error tracking
 */
export function initErrorTracking(): void {
  // Global error handler
  window.addEventListener('error', (event) => {
    captureError(event.error || new Error(event.message), {
      severity: 'fatal',
      extra: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });
  
  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    error.name = 'UnhandledRejection';
    captureError(error, { severity: 'error' });
  });
  
  // Navigation breadcrumbs
  window.addEventListener('popstate', () => {
    addBreadcrumb({
      type: 'navigation',
      category: 'history',
      message: `Navigated to ${window.location.pathname}`,
    });
  });
  
  // Click breadcrumbs (delegated)
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target) return;
    
    const tagName = target.tagName?.toLowerCase();
    const text = target.textContent?.trim().substring(0, 50) || '';
    const id = target.id ? `#${target.id}` : '';
    const className = target.className && typeof target.className === 'string' 
      ? `.${target.className.split(' ')[0]}` 
      : '';
    
    if (['button', 'a', 'input'].includes(tagName)) {
      addBreadcrumb({
        type: 'click',
        category: 'ui',
        message: `Clicked ${tagName}${id}${className}${text ? `: ${text}` : ''}`,
        level: 'info',
      });
    }
  }, { passive: true });
  
  // Console breadcrumbs (non-destructive)
  const originalConsoleError = console.error;
  console.error = (...args) => {
    addBreadcrumb({
      type: 'console',
      category: 'console',
      message: args.map(a => String(a)).join(' ').substring(0, 200),
      level: 'error',
    });
    originalConsoleError.apply(console, args);
  };
  
  const originalConsoleWarn = console.warn;
  console.warn = (...args) => {
    addBreadcrumb({
      type: 'console',
      category: 'console',
      message: args.map(a => String(a)).join(' ').substring(0, 200),
      level: 'warning',
    });
    originalConsoleWarn.apply(console, args);
  };
  
  // Initial breadcrumb
  addBreadcrumb({
    type: 'navigation',
    category: 'app',
    message: `App initialized at ${window.location.pathname}`,
  });
  
  console.log('[ErrorTracking] Initialized', { sessionId, isDevelopment });
}

/**
 * Get current session ID
 */
export function getSessionId(): string {
  return sessionId;
}

/**
 * Get recent breadcrumbs
 */
export function getBreadcrumbs(): Breadcrumb[] {
  return [...breadcrumbs];
}

/**
 * Clear all breadcrumbs
 */
export function clearBreadcrumbs(): void {
  breadcrumbs = [];
}

/**
 * Create a scoped error tracker for a specific feature
 */
export function createScope(name: string) {
  return {
    captureError: (error: Error, extra?: Record<string, unknown>) => 
      captureError(error, { 
        extra: { ...extra, scope: name },
        tags: { scope: name },
      }),
    addBreadcrumb: (breadcrumb: Omit<Breadcrumb, 'timestamp'>) => 
      addBreadcrumb({ ...breadcrumb, category: `${name}.${breadcrumb.category}` }),
  };
}

// Performance tracking
export function trackPerformance(name: string, duration: number, metadata?: Record<string, unknown>): void {
  addBreadcrumb({
    type: 'state',
    category: 'performance',
    message: `${name}: ${duration.toFixed(2)}ms`,
    data: { duration, ...metadata },
    level: duration > 1000 ? 'warning' : 'info',
  });
  
  if (duration > 3000) {
    captureMessage(`Slow operation: ${name} took ${duration.toFixed(0)}ms`, 'warning', { name, duration, ...metadata });
  }
}
