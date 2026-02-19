import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Rocket, LayoutDashboard, CalendarDays, Wrench, Users, HardDrive, BotMessageSquare, FileText, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { IndustryType, getIndustryTerminology } from '@/config/industryTerminology';

interface StoryCard {
  id: string;
  icon: LucideIcon;
  gradient: string;
  title: string;
  description: string;
}

function getStoryCards(industry: IndustryType): StoryCard[] {
  const t = getIndustryTerminology(industry);
  return [
    {
      id: 'welcome',
      icon: LayoutDashboard,
      gradient: 'from-blue-600 via-blue-700 to-indigo-800',
      title: 'Welcome to FieldTek',
      description: `Your command center for ${t.jobs.toLowerCase()}, ${t.technicians.toLowerCase()}, and revenue metrics.`,
    },
    {
      id: 'scheduling',
      icon: CalendarDays,
      gradient: 'from-indigo-600 via-indigo-700 to-purple-800',
      title: 'Drag & Drop Scheduling',
      description: `Visual scheduling board — see all ${t.technicians.toLowerCase()} and their ${t.jobs.toLowerCase()} at a glance.`,
    },
    {
      id: 'jobs',
      icon: Wrench,
      gradient: 'from-orange-500 via-orange-600 to-amber-700',
      title: `${t.job} Management`,
      description: `Track status, priority, and assignments. Filter and bulk-update with ease.`,
    },
    {
      id: 'clients',
      icon: Users,
      gradient: 'from-teal-500 via-teal-600 to-cyan-700',
      title: `${t.client} Database`,
      description: `Complete ${t.client.toLowerCase()} profiles with ${t.equipment.toLowerCase()} history and service records.`,
    },
    {
      id: 'equipment',
      icon: HardDrive,
      gradient: 'from-emerald-500 via-emerald-600 to-green-700',
      title: `${t.equipment} Tracking`,
      description: `Track warranties, service history, and maintenance schedules for every ${t.equipmentSingular.toLowerCase()}.`,
    },
    {
      id: 'assistant',
      icon: BotMessageSquare,
      gradient: 'from-violet-600 via-violet-700 to-purple-800',
      title: 'AI Field Assistant',
      description: `${t.technicians} get instant answers about procedures and ${t.equipment.toLowerCase()} specs.`,
    },
    {
      id: 'invoicing',
      icon: FileText,
      gradient: 'from-rose-500 via-rose-600 to-pink-700',
      title: 'Invoicing',
      description: `Create, send, and track invoices. One-click generation from completed ${t.jobs.toLowerCase()}.`,
    },
    {
      id: 'done',
      icon: Rocket,
      gradient: 'from-primary/80 via-primary/50 to-primary/30',
      title: "You're All Set!",
      description: 'Explore the demo freely or join the waitlist for early access.',
    },
  ];
}

const AUTO_ADVANCE_MS = 6000;

interface DemoStoryTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  industry?: IndustryType;
}

export function DemoStoryTour({ isOpen, onClose, onComplete, industry = 'general' }: DemoStoryTourProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  const cards = getStoryCards(industry);
  const card = cards[currentIndex];
  const isLastCard = currentIndex === cards.length - 1;

  const goNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setDirection(1);
      setCurrentIndex(i => i + 1);
    } else {
      onComplete();
      onClose();
    }
  }, [currentIndex, cards.length, onComplete, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(i => i - 1);
    }
  }, [currentIndex]);

  // Auto-advance timer
  useEffect(() => {
    if (!isOpen || isPaused || isLastCard) {
      setProgress(0);
      return;
    }

    startTimeRef.current = Date.now();
    setProgress(0);

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / AUTO_ADVANCE_MS) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        goNext();
      }
    }, 50);

    timerRef.current = progressInterval;
    return () => clearInterval(progressInterval);
  }, [isOpen, currentIndex, isPaused, isLastCard, goNext]);

  // Reset progress on index change
  useEffect(() => {
    setProgress(0);
    startTimeRef.current = Date.now();
  }, [currentIndex]);

  // Swipe gestures
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
    threshold: 40,
  });

  // Tap zones
  const handleTap = useCallback((e: React.MouseEvent) => {
    const x = e.clientX;
    const width = window.innerWidth;
    if (x < width * 0.3) {
      goPrev();
    } else {
      goNext();
    }
  }, [goNext, goPrev]);

  // Pause on hold
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsPaused(true);
    swipeHandlers.onTouchStart(e);
  }, [swipeHandlers]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    setIsPaused(false);
    swipeHandlers.onTouchEnd(e);
  }, [swipeHandlers]);

  const handleSkip = useCallback(() => {
    onComplete();
    onClose();
  }, [onComplete, onClose]);

  if (!isOpen) return null;

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleTap}
    >
      {/* Progress segments */}
      <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 px-3 pt-3">
        {cards.map((_, i) => (
          <div key={i} className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-100"
              style={{
                width:
                  i < currentIndex
                    ? '100%'
                    : i === currentIndex
                      ? `${progress}%`
                      : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); handleSkip(); }}
        className="absolute top-10 right-3 z-20 p-2 text-white/80 hover:text-white"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Card content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={card.id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'tween', duration: 0.3 }}
          className="absolute inset-0 flex flex-col"
        >
          {/* Gradient background with icon */}
          <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient}`} />
          {!isLastCard && (
            <div className="absolute inset-0 flex items-center justify-center opacity-15">
              <card.icon className="h-64 w-64" strokeWidth={1} />
            </div>
          )}

          {/* Text content at bottom */}
          <div className="mt-auto relative z-10 px-6 pb-24">
            {isLastCard && (
              <Rocket className="h-10 w-10 text-white mb-4" />
            )}
            <h2 className="text-2xl font-bold text-white mb-3 leading-tight">
              {card.title}
            </h2>
            <p className="text-white/80 text-base leading-relaxed max-w-sm">
              {card.description}
            </p>

            {/* CTA on last card */}
            {isLastCard && (
              <div className="flex gap-3 mt-6" onClick={e => e.stopPropagation()}>
                <Button
                  size="lg"
                  onClick={handleSkip}
                  className="flex-1 bg-white text-black hover:bg-white/90 font-semibold"
                >
                  Explore Demo
                </Button>
              </div>
            )}
          </div>

          {/* Navigation hint on first card */}
          {currentIndex === 0 && (
            <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-2 text-white/50 text-xs">
              <ChevronLeft className="h-3 w-3" />
              <span>Tap or swipe to navigate</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          )}

          {/* Step indicator */}
          {!isLastCard && (
            <div className="absolute bottom-8 right-6 text-white/40 text-xs">
              {currentIndex + 1} / {cards.length}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
}
