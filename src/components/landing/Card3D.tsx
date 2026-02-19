import { memo, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/useReducedAnimations";

interface Card3DProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  intensity?: number; // 0-1, default 0.5
  glowOnHover?: boolean;
}

export const Card3D = memo(function Card3D({
  children,
  className,
  innerClassName,
  intensity = 0.5,
  glowOnHover = true,
}: Card3DProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion || !cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Calculate rotation based on mouse position relative to center
      // Intensity controls the maximum rotation angle (0-15 degrees)
      const maxRotation = 15 * intensity;
      const rotateY = ((x - centerX) / centerX) * maxRotation;
      const rotateX = ((centerY - y) / centerY) * maxRotation;

      setTransform({ rotateX, rotateY });
    },
    [prefersReducedMotion, intensity]
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTransform({ rotateX: 0, rotateY: 0 });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  if (prefersReducedMotion) {
    // Return simple version without 3D effects for accessibility
    return (
      <div className={cn("card-3d-fallback", className)}>
        <div className={innerClassName}>{children}</div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={cn(
        "card-3d-wrapper relative",
        isHovered && glowOnHover && "card-3d-glow",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: "1000px",
        transformStyle: "preserve-3d",
      }}
    >
      <div
        className={cn("card-3d-content transition-transform duration-200 ease-out", innerClassName)}
        style={{
          transform: `rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg) translateZ(${isHovered ? 10 : 0}px)`,
          transformStyle: "preserve-3d",
        }}
      >
        {children}
      </div>
    </div>
  );
});

export default Card3D;
