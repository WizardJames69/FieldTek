import * as React from "react";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-9 px-3 text-sm",
  default: "h-10 px-5 text-sm",
  lg: "h-11 px-8 text-base",
};

export interface LiquidButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "default" | "lg";
}

const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  ({ size = "default", className, disabled, children, ...props }, ref) => {
    return (
      <div
        className={cn(
          "relative rounded-[11px] p-[1px] overflow-hidden group",
          disabled && "opacity-50 pointer-events-none",
        )}
      >
        {/* Animated gradient border */}
        <div
          className="absolute inset-0 rounded-[11px]"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(255,255,255,0.08), rgba(255,255,255,0.2), rgba(249,115,22,0.3), rgba(255,255,255,0.08))",
            animation: "liquid-spin 4s linear infinite",
          }}
        />

        <button
          ref={ref}
          disabled={disabled}
          className={cn(
            "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium",
            "bg-[#111214]/90 backdrop-blur-sm text-white",
            "transition-all duration-200 hover:bg-[#191b1f]/90 active:scale-[0.97]",
            "disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
            "border border-white/[0.06]",
            sizeClasses[size],
            className,
          )}
          {...props}
        >
          {children}
        </button>
      </div>
    );
  },
);
LiquidButton.displayName = "LiquidButton";

export { LiquidButton };
