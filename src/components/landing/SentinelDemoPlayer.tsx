import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePrefersReducedMotion } from "@/hooks/useReducedAnimations";
import frameIdle from "@/assets/landing/sentinel-demo-1-idle.webp";
import frameGrounding from "@/assets/landing/sentinel-demo-3-grounding.webp";
import frameAnswer from "@/assets/landing/sentinel-demo-4-answer.webp";
import frameSaved from "@/assets/landing/sentinel-demo-5-saved.webp";
import mobileAnswer from "@/assets/landing/sentinel-demo-mobile.webp";

/**
 * Animated Sentinel product demo built from four real screenshots of one live
 * grounded conversation on the North Shore HVAC sample tenant: idle workspace,
 * question sent with the grounded-retrieval handoff, cited answer with the
 * real confidence label, and the answer saved to the job. A crossfaded frame
 * sequence was chosen over video deliberately: chat-sized text stays
 * pixel-sharp at a fraction of the weight (~250 KB for the loop), and pacing,
 * looping, and accessibility remain fully controllable.
 *
 * Story pacing rule: the cited answer (the differentiator) must be on screen
 * within ~4 seconds of the loop starting and holds the longest dwell.
 *
 * Motion policy: the loop only advances while the player is in view. Users
 * with prefers-reduced-motion get the completed-answer frame as a static
 * image; mobile gets a tighter crop of the same completed exchange (question,
 * checks, citations, confidence) because the full workspace frame is
 * unreadable at phone width.
 */

const FRAME_WIDTH = 1968;
const FRAME_HEIGHT = 1510;

const FRAMES = [
  { src: frameIdle, dwellMs: 1200 },
  { src: frameGrounding, dwellMs: 1500 },
  { src: frameAnswer, dwellMs: 4500 },
  { src: frameSaved, dwellMs: 2200 },
];

const NARRATIVE =
  "Animated demo of Sentinel AI on sample data: a technician asks what to check " +
  "for weak cooling on a Carrier air handler after a filter change. Sentinel " +
  "searches the company's uploaded manuals and answers with three recommended " +
  "checks, page-level citations to the installation manual, a confidence " +
  "rating, and a Save to Job action.";

export function SentinelDemoPlayer() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion || isMobile || !inView) return;
    const timer = setTimeout(
      () => setFrame((current) => (current + 1) % FRAMES.length),
      FRAMES[frame].dwellMs,
    );
    return () => clearTimeout(timer);
  }, [frame, inView, prefersReducedMotion, isMobile]);

  // Phone width: the payoff crop (question, answer, citations, confidence)
  // instead of the full workspace, whether motion is allowed or not.
  if (isMobile) {
    return (
      <img
        src={mobileAnswer}
        alt={NARRATIVE}
        width={1358}
        height={770}
        loading="lazy"
        decoding="async"
        className="w-full h-auto"
      />
    );
  }

  if (prefersReducedMotion) {
    return (
      <img
        src={frameAnswer}
        alt={NARRATIVE}
        width={FRAME_WIDTH}
        height={FRAME_HEIGHT}
        loading="lazy"
        decoding="async"
        className="w-full h-auto"
      />
    );
  }

  return (
    <div
      ref={ref}
      role="img"
      aria-label={NARRATIVE}
      className="relative w-full"
      style={{ aspectRatio: `${FRAME_WIDTH} / ${FRAME_HEIGHT}` }}
    >
      {FRAMES.map((f, i) => (
        <img
          key={f.src}
          src={f.src}
          alt=""
          aria-hidden="true"
          width={FRAME_WIDTH}
          height={FRAME_HEIGHT}
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full transition-opacity duration-500 ease-out ${
            i === frame ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </div>
  );
}
