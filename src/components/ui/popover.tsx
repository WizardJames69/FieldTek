import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        // Phase 5: Enhanced floating UI with glass effect
        "z-50 w-72 rounded-lg p-4 text-popover-foreground outline-none",
        "backdrop-blur-xl border bg-popover/95 dark:bg-popover/90",
        "shadow-lg shadow-black/5 dark:shadow-black/20",
        // Inner glow for premium feel
        "[box-shadow:0_4px_6px_-1px_hsl(0_0%_0%/0.1),0_2px_4px_-2px_hsl(0_0%_0%/0.1),inset_0_1px_0_0_hsl(0_0%_100%/0.05)]",
        // Animations
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-96 data-[state=open]:zoom-in-96",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
