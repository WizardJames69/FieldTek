import { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";

interface UseCountUpOptions {
  duration?: number;
  delay?: number;
}

export function useCountUp(
  endValue: string,
  options: UseCountUpOptions = {}
) {
  const { duration = 1000, delay = 0 } = options;
  const [displayValue, setDisplayValue] = useState(endValue);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    if (!isInView || hasAnimated) return;

    // Extract numeric value and format info
    const numericMatch = endValue.match(/[\d.]+/);
    if (!numericMatch) {
      setDisplayValue(endValue);
      setHasAnimated(true);
      return;
    }

    const numericValue = parseFloat(numericMatch[0]);
    const prefix = endValue.slice(0, endValue.indexOf(numericMatch[0]));
    const suffix = endValue.slice(endValue.indexOf(numericMatch[0]) + numericMatch[0].length);
    const hasDecimal = numericMatch[0].includes(".");
    const decimalPlaces = hasDecimal ? numericMatch[0].split(".")[1]?.length || 0 : 0;

    const startTime = performance.now() + delay;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      
      if (elapsed < 0) {
        animationFrame = requestAnimationFrame(animate);
        return;
      }

      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = numericValue * easeOut;

      if (progress < 1) {
        const formattedValue = hasDecimal 
          ? currentValue.toFixed(decimalPlaces)
          : Math.floor(currentValue).toString();
        setDisplayValue(`${prefix}${formattedValue}${suffix}`);
        animationFrame = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setHasAnimated(true);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isInView, endValue, duration, delay, hasAnimated]);

  return { ref, displayValue };
}
