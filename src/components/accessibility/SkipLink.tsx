import { cn } from '@/lib/utils';

interface SkipLinkProps {
  targetId?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Skip link component for keyboard users to bypass navigation
 * Visible only when focused via keyboard
 */
export function SkipLink({ 
  targetId = 'main-content', 
  children = 'Skip to main content',
  className 
}: SkipLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={cn(
        // Visually hidden by default
        'absolute left-4 top-4 z-[100]',
        'px-4 py-2 rounded-md',
        'bg-primary text-primary-foreground font-medium',
        'shadow-lg',
        // Hidden until focused
        'opacity-0 -translate-y-full pointer-events-none',
        'focus:opacity-100 focus:translate-y-0 focus:pointer-events-auto',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className
      )}
    >
      {children}
    </a>
  );
}

/**
 * Wrapper for main content area that receives focus from skip link
 */
export function MainContent({ 
  children, 
  className,
  id = 'main-content' 
}: { 
  children: React.ReactNode; 
  className?: string;
  id?: string;
}) {
  return (
    <main 
      id={id} 
      tabIndex={-1} 
      className={cn('focus:outline-none', className)}
      aria-label="Main content"
    >
      {children}
    </main>
  );
}
