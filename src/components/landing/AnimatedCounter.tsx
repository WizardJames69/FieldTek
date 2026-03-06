import { useEffect, useRef, useState, useCallback } from "react";

interface AnimatedCounterProps {
  value: string;
  className?: string;
}

export function AnimatedCounter({ value, className = "" }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayValue, setDisplayValue] = useState(value);
  const hasAnimated = useRef(false);

  const parseValue = useCallback((val: string) => {
    const match = val.match(/^([^\d]*)(\d+(?:\.\d+)?)(.*)$/);
    if (!match) return { prefix: "", number: 0, suffix: val, decimals: 0 };
    const numStr = match[2];
    const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
    return {
      prefix: match[1],
      number: parseFloat(numStr),
      suffix: match[3],
      decimals,
    };
  }, []);

  useEffect(() => {
    if (hasAnimated.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            const { prefix, number, suffix, decimals } = parseValue(value);

            // Non-numeric values — display as static text
            if (number === 0 && !prefix) {
              setDisplayValue(value);
              observer.disconnect();
              return;
            }

            const duration = 1200;
            const startTime = performance.now();

            const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

            const animate = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const easedProgress = easeOut(progress);
              const current = easedProgress * number;
              setDisplayValue(
                `${prefix}${current.toFixed(decimals)}${suffix}`
              );
              if (progress < 1) {
                requestAnimationFrame(animate);
              }
            };

            requestAnimationFrame(animate);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [value, parseValue]);

  return (
    <span ref={ref} className={className}>
      {displayValue}
    </span>
  );
}
