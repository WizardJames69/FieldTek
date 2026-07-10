import { cn } from "@/lib/utils";

interface SentinelMarkProps {
  className?: string;
  /** Bump slightly (e.g. 2.4) for renderings at 16px and below. */
  strokeWidth?: number;
}

/**
 * The Sentinel product mark: a signal node connected to ground.
 *
 * The form is the earth-ground symbol from electrical schematics — the
 * trades' own notation for reference truth, printed on the wiring diagram
 * inside every panel door — with one addition: the node above it, the
 * answer. Every answer Sentinel gives is connected to ground: retrieved
 * from the tenant's documentation, cited as evidence, and withheld when
 * no ground exists. The mark is that promise drawn literally.
 *
 * Construction: filled node, stem, three tapering bars. Five strokes,
 * bottom-weighted so it sits planted and calm. Single currentColor so it
 * inherits tenant-branded tokens anywhere in FieldTek. Deliberately not a
 * shield, sparkle, star, robot, brain, chat bubble, or anything an icon
 * pack ships.
 */
export function SentinelMark({ className, strokeWidth = 2.1 }: SentinelMarkProps) {
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
      {/* Signal node: the answer */}
      <circle cx="12" cy="4.4" r="1.9" fill="currentColor" stroke="none" />
      {/* Stem: the connection */}
      <path d="M12 6.9V12.4" />
      {/* Ground: the evidence it stands on */}
      <path d="M4.75 12.4h14.5" />
      <path d="M7.5 16.2h9" />
      <path d="M10.25 20h3.5" />
    </svg>
  );
}
