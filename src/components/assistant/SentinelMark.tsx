import { cn } from "@/lib/utils";

interface SentinelMarkProps {
  className?: string;
  /** Slightly heavier stroke for tiny (< 16px) renderings. */
  strokeWidth?: number;
}

/**
 * The Sentinel product mark: a shield carrying a diagnostic trace.
 *
 * Shield = the watchman (Sentinel guards the quality of every answer);
 * trace = the field signal it reads (symptoms, measurements, equipment
 * behavior). Single currentColor so it inherits the tenant-branded token
 * from its container (the app's primary/10 chip treatment), which keeps it
 * in the FieldTek family without duplicating the wordmark. Deliberately
 * not a sparkle, wand, robot, or star.
 */
export function SentinelMark({ className, strokeWidth = 1.9 }: SentinelMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {/* Shield */}
      <path d="M12 2.6 19 5.4v5.9c0 4.8-2.9 8.2-7 9.9-4.1-1.7-7-5.1-7-9.9V5.4L12 2.6Z" />
      {/* Diagnostic trace */}
      <path d="M7.4 12h2l1.5-3 2.2 6 1.5-3h2" />
    </svg>
  );
}
