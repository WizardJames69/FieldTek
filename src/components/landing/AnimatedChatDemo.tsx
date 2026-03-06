import { useEffect, useRef, useState } from "react";
import { Bot, Send } from "lucide-react";

interface ChatStep {
  type: "user" | "typing" | "ai";
  delay: number;
  content?: React.ReactNode;
}

const steps: ChatStep[] = [
  // First tech message
  {
    type: "user",
    delay: 0,
    content: "Carrier 24ACC636 not cooling. Compressor runs but no cold air.",
  },
  // Typing indicator
  { type: "typing", delay: 800 },
  // First AI response
  {
    type: "ai",
    delay: 2300,
    content: (
      <div className="space-y-1.5">
        <p className="text-zinc-200 font-medium">Based on the installation manual (p.12-14):</p>
        <p>1. Verify all electrical connections match the wiring diagram</p>
        <p>2. Check refrigerant charge. Factory charge covers 15ft of line set</p>
        <p>3. Set thermostat to cooling mode, lower setpoint 3°F below ambient</p>
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-zinc-700/60">
          <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded font-medium">
            High Confidence
          </span>
          <span className="text-[10px] text-zinc-600">Source: Carrier 24ACC Manual</span>
        </div>
      </div>
    ),
  },
  // Second tech message
  {
    type: "user",
    delay: 4500,
    content: "High side: 150 PSI, Low side: 45 PSI",
  },
  // Typing indicator
  { type: "typing", delay: 5300 },
  // Second AI response with warning
  {
    type: "ai",
    delay: 6800,
    content: (
      <div className="space-y-1.5">
        <p>
          Per Carrier spec sheet, normal readings are{" "}
          <span className="text-zinc-200 font-medium">225-250 PSI</span> (high) and{" "}
          <span className="text-zinc-200 font-medium">65-70 PSI</span> (low).
        </p>
        <p>Your readings confirm low refrigerant. Likely need TXV valve + recharge.</p>
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-zinc-700/60">
          <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-medium">
            ⚠ Warranty expires in 23 days
          </span>
          <span className="text-[10px] text-zinc-600">Carrier Specs + History</span>
        </div>
      </div>
    ),
  },
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-zinc-500"
          style={{
            animation: "chatDotPulse 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

export function AnimatedChatDemo() {
  const [visibleSteps, setVisibleSteps] = useState<number[]>([]);
  const hasPlayedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);

  // Scroll trigger — play once when 30% visible
  useEffect(() => {
    const el = containerRef.current;
    if (!el || hasPlayedRef.current) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasPlayedRef.current) {
          hasPlayedRef.current = true;
          observer.disconnect();

          if (prefersReduced) {
            // Show all messages immediately
            setVisibleSteps(steps.map((_, i) => i).filter((i) => steps[i].type !== "typing"));
            return;
          }

          // Schedule each step
          steps.forEach((step, i) => {
            const timer = window.setTimeout(() => {
              setVisibleSteps((prev) => {
                // When an AI message appears, remove its preceding typing indicator
                if (step.type === "ai") {
                  return [...prev.filter((idx) => steps[idx].type !== "typing"), i];
                }
                // When typing appears, remove any previous typing
                if (step.type === "typing") {
                  return [...prev.filter((idx) => steps[idx].type !== "typing"), i];
                }
                return [...prev, i];
              });
            }, step.delay);
            timersRef.current.push(timer);
          });
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Auto-scroll chat area as messages appear
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [visibleSteps]);

  return (
    <>
      <style>{`
        @keyframes chatDotPulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.85); }
          30% { opacity: 1; transform: scale(1); }
        }
        @keyframes chatMsgIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .chat-msg-enter {
          animation: chatMsgIn 0.3s ease-out forwards;
        }
      `}</style>

      <div
        ref={containerRef}
        className="rounded-2xl border border-white/[0.06] bg-[#111214] overflow-hidden"
      >
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-[#111214]">
          <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-orange-500" />
          </div>
          <span className="text-xs font-medium text-zinc-300">FieldTek AI Assistant</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-auto" />
        </div>

        {/* Chat area */}
        <div
          ref={chatAreaRef}
          className="p-4 space-y-3 min-h-[280px] md:min-h-[320px] max-h-[380px] overflow-y-auto"
        >
          {visibleSteps.map((stepIdx) => {
            const step = steps[stepIdx];

            if (step.type === "typing") {
              return (
                <div key={`typing-${stepIdx}`} className="flex justify-start chat-msg-enter">
                  <div className="bg-zinc-800/80 rounded-lg rounded-bl-sm">
                    <TypingIndicator />
                  </div>
                </div>
              );
            }

            if (step.type === "user") {
              return (
                <div key={stepIdx} className="flex justify-end chat-msg-enter">
                  <div className="bg-orange-500/15 text-orange-200 text-xs rounded-lg rounded-br-sm px-3 py-2 max-w-[80%]">
                    {step.content}
                  </div>
                </div>
              );
            }

            // AI message
            return (
              <div key={stepIdx} className="flex justify-start chat-msg-enter">
                <div className="bg-zinc-800/60 text-zinc-400 text-xs rounded-lg rounded-bl-sm px-3 py-2.5 max-w-[88%] leading-relaxed">
                  {step.content}
                </div>
              </div>
            );
          })}
        </div>

        {/* Decorative input bar */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
            <span className="text-xs text-zinc-600 flex-1">Ask about any equipment...</span>
            <div className="w-6 h-6 rounded-md bg-orange-500/10 flex items-center justify-center">
              <Send className="w-3 h-3 text-orange-500/60" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
