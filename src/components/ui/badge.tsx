import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Status variants with subtle inner glow
        success: "border-transparent bg-success/15 text-success backdrop-blur-sm",
        warning: "border-transparent bg-warning/15 text-warning backdrop-blur-sm",
        info: "border-transparent bg-info/15 text-info backdrop-blur-sm",
      },
      glow: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      { variant: "default", glow: true, className: "shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_0_10px_-2px_hsl(var(--primary)/0.4)]" },
      { variant: "destructive", glow: true, className: "shadow-[0_0_0_1px_hsl(var(--destructive)/0.3),0_0_10px_-2px_hsl(var(--destructive)/0.4)]" },
      { variant: "success", glow: true, className: "shadow-[0_0_0_1px_hsl(var(--success)/0.3),0_0_10px_-2px_hsl(var(--success)/0.4)]" },
      { variant: "warning", glow: true, className: "shadow-[0_0_0_1px_hsl(var(--warning)/0.3),0_0_10px_-2px_hsl(var(--warning)/0.4)]" },
      { variant: "info", glow: true, className: "shadow-[0_0_0_1px_hsl(var(--info)/0.3),0_0_10px_-2px_hsl(var(--info)/0.4)]" },
    ],
    defaultVariants: {
      variant: "default",
      glow: false,
    },
  },
);

export interface BadgeProps 
  extends React.HTMLAttributes<HTMLDivElement>, 
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, glow, ...props }, ref) => {
    return (
      <div 
        ref={ref} 
        className={cn(badgeVariants({ variant, glow }), className)} 
        {...props} 
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
