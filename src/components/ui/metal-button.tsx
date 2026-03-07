import * as React from "react";
import { cn } from "@/lib/utils";

type ColorVariant = "default" | "success" | "fieldtek";

const colorVariants = {
  default: {
    outer: "bg-gradient-to-b from-[#1a1a2e] to-[#b8b8d0]",
    inner: "bg-gradient-to-b from-[#e8e8f0] via-[#2a2a40] to-[#c8c8e0]",
    button: "bg-gradient-to-b from-[#6366F1] to-[#4338CA]",
    textColor: "text-white",
    textShadow: "[text-shadow:_0_-1px_0_rgb(67_56_202_/_100%)]",
  },
  success: {
    outer: "bg-gradient-to-b from-[#0a2e1a] to-[#86efac]",
    inner: "bg-gradient-to-b from-[#dcfce7] via-[#166534] to-[#bbf7d0]",
    button: "bg-gradient-to-b from-[#22c55e] to-[#15803d]",
    textColor: "text-white",
    textShadow: "[text-shadow:_0_-1px_0_rgb(21_128_61_/_100%)]",
  },
  fieldtek: {
    outer: "bg-gradient-to-b from-[#7C3A0A] to-[#FDBA74]",
    inner: "bg-gradient-to-b from-[#FFF1E0] via-[#8B4513] to-[#FFD9B3]",
    button: "bg-gradient-to-b from-[#FB923C] to-[#C2410C]",
    textColor: "text-white",
    textShadow: "[text-shadow:_0_-1px_0_rgb(124_45_18_/_100%)]",
  },
};

const sizeClasses = {
  sm: "h-9 px-3 text-sm",
  default: "h-10 px-5 text-sm",
  lg: "h-11 px-8 text-base",
};

export interface MetalButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ColorVariant;
  size?: "sm" | "default" | "lg";
}

const MetalButton = React.forwardRef<HTMLButtonElement, MetalButtonProps>(
  ({ variant = "default", size = "default", className, disabled, children, ...props }, ref) => {
    const colors = colorVariants[variant];

    return (
      <div
        className={cn(
          "rounded-[11px] p-[1px]",
          colors.outer,
          disabled && "opacity-50 pointer-events-none",
        )}
      >
        <div className={cn("rounded-[10px] p-[1px]", colors.inner)}>
          <button
            ref={ref}
            disabled={disabled}
            className={cn(
              "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[9px] font-semibold",
              "transition-all duration-150 hover:brightness-110 active:scale-[0.97]",
              "disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
              colors.button,
              colors.textColor,
              colors.textShadow,
              sizeClasses[size],
              className,
            )}
            {...props}
          >
            {children}
          </button>
        </div>
      </div>
    );
  },
);
MetalButton.displayName = "MetalButton";

export { MetalButton };
