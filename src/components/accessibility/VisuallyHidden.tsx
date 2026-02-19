import * as React from 'react';
import { cn } from '@/lib/utils';

interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  asChild?: boolean;
}

/**
 * VisuallyHidden component for screen reader-only content
 * Content is hidden visually but remains accessible to assistive technologies
 */
export function VisuallyHidden({ 
  children, 
  className,
  asChild = false,
  ...props 
}: VisuallyHiddenProps) {
  const classes = cn(
    'sr-only',
    // Additional reinforcement for older browsers
    'absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0',
    '[clip:rect(0,0,0,0)]',
    className
  );

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      className: cn(children.props.className, classes),
    } as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}

/**
 * LiveRegion component for announcing dynamic content changes
 * Used for status messages, form validation, loading states, etc.
 */
export function LiveRegion({
  children,
  politeness = 'polite',
  atomic = true,
  className,
  ...props
}: {
  children: React.ReactNode;
  politeness?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      className={cn('sr-only', className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Announce component for programmatic screen reader announcements
 */
export function Announce({
  message,
  politeness = 'polite',
}: {
  message: string;
  politeness?: 'polite' | 'assertive';
}) {
  const [announcement, setAnnouncement] = React.useState('');

  React.useEffect(() => {
    // Clear and re-announce to ensure screen readers pick it up
    setAnnouncement('');
    const timeoutId = setTimeout(() => {
      setAnnouncement(message);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [message]);

  return (
    <LiveRegion politeness={politeness}>
      {announcement}
    </LiveRegion>
  );
}
