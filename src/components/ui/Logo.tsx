import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  asLink?: boolean;
  showBetaBadge?: boolean;
}

export function Logo({ size = "md", className, asLink = true, showBetaBadge = true }: LogoProps) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  const content = (
    <span className={cn("font-display font-bold flex items-center gap-2", sizeClasses[size], className)}>
      <span>
        <span className="text-foreground">Field</span>
        <span className="text-primary">Tek</span>
      </span>
      {showBetaBadge && (
        <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-wide">
          Beta
        </span>
      )}
    </span>
  );

  if (asLink) {
    return (
      <Link to="/" className="group flex items-center hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
