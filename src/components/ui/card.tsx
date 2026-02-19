import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-xl border bg-card/95 backdrop-blur-sm text-card-foreground shadow-sm transition-all duration-200",
  {
    variants: {
      variant: {
        default: "hover:shadow-md hover:border-primary/20",
        elevated: [
          "shadow-md",
          "hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5",
        ],
        interactive: [
          "cursor-pointer touch-native",
          "hover:shadow-lg hover:border-primary/30 hover:-translate-y-1",
          "active:scale-[0.99] active:shadow-md",
        ],
        glass: [
          "bg-card/80 backdrop-blur-xl",
          "border-border/50",
          "shadow-[0_4px_20px_-4px_hsl(0_0%_0%/0.08),inset_0_1px_0_0_hsl(0_0%_100%/0.08)]",
        ],
      },
      glow: {
        none: "",
        primary: "hover:shadow-[0_8px_24px_-4px_hsl(var(--primary)/0.15)]",
        success: "hover:shadow-[0_8px_24px_-4px_hsl(var(--success)/0.15)]",
        warning: "hover:shadow-[0_8px_24px_-4px_hsl(var(--warning)/0.15)]",
        destructive: "hover:shadow-[0_8px_24px_-4px_hsl(var(--destructive)/0.15)]",
      },
    },
    defaultVariants: {
      variant: "default",
      glow: "none",
    },
  }
);

export interface CardProps 
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, glow, ...props }, ref) => (
    <div 
      ref={ref} 
      className={cn(cardVariants({ variant, glow }), className)} 
      {...props} 
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };
