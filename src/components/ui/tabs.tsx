import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const tabsListVariants = cva(
  "inline-flex items-center justify-center p-1 text-muted-foreground gap-0.5",
  {
    variants: {
      variant: {
        default: [
          "h-10 rounded-xl bg-muted/60 backdrop-blur-sm",
          "border border-border/50",
        ],
        glass: [
          "h-11 rounded-xl",
          "bg-background/40 backdrop-blur-xl",
          "border border-border/30",
          "shadow-[0_2px_10px_-3px_hsl(0_0%_0%/0.1),inset_0_1px_0_0_hsl(0_0%_100%/0.1)]",
        ],
        pills: [
          "h-10 rounded-full bg-muted/50 backdrop-blur-sm",
          "border border-border/40",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant }), className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const tabsTriggerVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium",
    "ring-offset-background transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.97] touch-native",
  ],
  {
    variants: {
      variant: {
        default: [
          "rounded-lg px-3 py-1.5",
          "data-[state=active]:bg-background/95 data-[state=active]:backdrop-blur-sm",
          "data-[state=active]:text-foreground data-[state=active]:shadow-sm",
          "data-[state=active]:ring-1 data-[state=active]:ring-primary/30",
          "data-[state=inactive]:hover:bg-background/50 data-[state=inactive]:hover:text-foreground/80",
        ],
        glass: [
          "rounded-lg px-4 py-2",
          "data-[state=active]:bg-background/90 data-[state=active]:backdrop-blur-sm",
          "data-[state=active]:text-foreground",
          "data-[state=active]:shadow-[0_2px_8px_hsl(var(--primary)/0.1),inset_0_0_0_1px_hsl(var(--primary)/0.15)]",
          "data-[state=inactive]:hover:bg-background/40 data-[state=inactive]:hover:text-foreground/80",
        ],
        pills: [
          "rounded-full px-4 py-1.5",
          "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
          "data-[state=active]:shadow-[0_2px_8px_hsl(var(--primary)/0.3)]",
          "data-[state=inactive]:hover:bg-background/60 data-[state=inactive]:hover:text-foreground/80",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant }), className)}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      // Smooth content fade-in
      "data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabsTriggerVariants };
