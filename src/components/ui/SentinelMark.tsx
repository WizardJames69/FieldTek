import { cn } from "@/lib/utils";

interface SentinelMarkProps {
  className?: string;
  /** Bump slightly (e.g. 2.3) for renderings at 16px and below. */
  strokeWidth?: number;
  /**
   * Branded treatment: colors the grounded (lower) run with the FieldTek
   * accent. Reserve it for identity moments (identity bar, empty state);
   * everywhere else the mark stays monochrome currentColor.
   */
  accent?: boolean;
}

/**
 * The Sentinel product mark: the handoff.
 *
 * Two opposing signal runs interlock mid-frame — the question coming down
 * from the field, the grounded evidence coming up to meet it. Sentinel is
 * the handoff between them. The S is discovered in the offset between the
 * runs, never announced as a letterform.
 *
 * Two strokes, no micro-detail: the silhouette survives 16px to 64px
 * unchanged, works monochrome by construction, and stays level and calm
 * beside text. In the branded treatment only the lower run — the answer
 * that reached ground — carries the accent. Deliberately not a shield,
 * sparkle, star, robot, brain, chat bubble, monogram, or anything an icon
 * pack ships.
 */
export function SentinelMark({ className, strokeWidth = 2, accent = false }: SentinelMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-sentinel-mark=""
      className={cn("shrink-0", className)}
    >
      {/* The question run */}
      <path d="M17.4 7.4H9.8Q7.2 7.4 7.2 10v3.1" />
      {/* The grounded run */}
      <path className={accent ? "text-accent" : undefined} d="M6.6 16.6h7.6q2.6 0 2.6-2.6v-3.1" />
    </svg>
  );
}
