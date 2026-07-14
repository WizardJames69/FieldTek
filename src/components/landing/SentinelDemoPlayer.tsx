import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePrefersReducedMotion } from "@/hooks/useReducedAnimations";
import frameIdle from "@/assets/landing/sentinel-demo-1-idle.webp";
import frameQuestion from "@/assets/landing/sentinel-demo-2-question.webp";
import frameGrounding from "@/assets/landing/sentinel-demo-3-grounding.webp";
import frameAnswer from "@/assets/landing/sentinel-demo-4-answer.webp";
import frameSaved from "@/assets/landing/sentinel-demo-5-saved.webp";

/**
 * Animated Sentinel product demo built from five real screenshots of one live
 * grounded conversation on the North Shore HVAC sample tenant: idle workspace,
 * question in the composer, grounded-retrieval handoff, cited answer with the
 * real confidence label, and the answer saved to the job. A crossfaded frame
 * sequence was chosen over video deliberately: chat-sized text stays
 * pixel-sharp at a fraction of the weight (~340 KB for all five frames), and
 * pacing, looping, and accessibility remain fully controllable.
 *
 * Motion policy: the loop only advances while the player is in view, and users
 * with prefers-reduced-motion (as well as mobile, where the frames would be
 * too small to follow) get the strongest completed-answer frame as a static
 * image instead.
 */

const FRAME_WIDTH = 1968;
const FRAME_HEIGHT = 1800;

const FRAMES = [
  { src: frameIdle, dwellMs: 1500 },
  { src: frameQuestion, dwellMs: 1700 },
  { src: frameGrounding, dwellMs: 1300 },
  { src: frameAnswer, dwellMs: 3400 },
  { src: frameSaved, dwellMs: 2100 },
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

  const staticOnly = prefersReducedMotion || isMobile;

  useEffect(() => {
    if (staticOnly || !inView) return;
    const timer = setTimeout(
      () => setFrame((current) => (current + 1) % FRAMES.length),
      FRAMES[frame].dwellMs,
    );
    return () => clearTimeout(timer);
  }, [frame, inView, staticOnly]);

  if (staticOnly) {
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
