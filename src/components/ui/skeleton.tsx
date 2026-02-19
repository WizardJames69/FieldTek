import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Use 'wave' for a more polished shimmer effect */
  variant?: 'default' | 'wave';
}

function Skeleton({ className, variant = 'wave', ...props }: SkeletonProps) {
  return (
    <div 
      className={cn(
        "rounded-md bg-muted/80",
        variant === 'wave' 
          ? "skeleton-shimmer" 
          : "animate-pulse",
        className
      )} 
      {...props} 
    />
  );
}

export { Skeleton };
