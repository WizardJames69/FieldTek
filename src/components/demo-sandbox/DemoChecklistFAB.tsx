import { useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DemoChecklist } from './DemoChecklist';
import { useDemoSandbox } from '@/contexts/DemoSandboxContext';
import { cn } from '@/lib/utils';

export function DemoChecklistFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const { featuresExplored, featureChecklist, checklistProgress } = useDemoSandbox();
  
  const isComplete = checklistProgress === 100;
  const exploredCount = featuresExplored.length;
  const totalCount = featureChecklist.length;

  return (
    <>
      {/* FAB - only visible on mobile/tablet (below lg breakpoint) */}
      <div className="fixed bottom-6 right-6 lg:hidden z-40 overflow-visible">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 20 }}
          style={{ overflow: 'visible' }}
          className="relative"
        >
          {/* Progress badge - outside button to avoid clipping */}
          <span 
            className={cn(
              'absolute -top-2 left-1/2 -translate-x-1/2 z-10 min-w-[32px] h-[20px] rounded-full text-[10px] font-bold flex items-center justify-center px-2 whitespace-nowrap pointer-events-none',
              isComplete 
                ? 'bg-yellow-400 text-yellow-900' 
                : 'bg-secondary text-secondary-foreground'
            )}
          >
            {exploredCount}/{totalCount}
          </span>
          <Button
            size="lg"
            onClick={() => setIsOpen(true)}
            className={cn(
              'h-14 w-14 rounded-full shadow-lg',
              isComplete 
                ? 'bg-green-500 hover:bg-green-600' 
                : 'bg-primary hover:bg-primary/90'
            )}
          >
            {isComplete ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <ClipboardList className="h-6 w-6" />
            )}
          </Button>
        </motion.div>
        
        {/* Pulse animation when not complete - reduced for performance */}
        {!isComplete && (
          <div className="absolute inset-0 rounded-full bg-primary/20 -z-10 animate-ping" style={{ animationDuration: '2s' }} />
        )}
      </div>

      {/* Sheet with checklist */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle>Demo Progress</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-[calc(100%-60px)]">
            <DemoChecklist onNavigate={() => setIsOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
