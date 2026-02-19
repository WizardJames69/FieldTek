import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface BulkActionToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  children: ReactNode;
  className?: string;
}

export function BulkActionToolbar({
  selectedCount,
  onClearSelection,
  children,
  className,
}: BulkActionToolbarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
            'bg-background/95 backdrop-blur-lg border rounded-xl shadow-2xl',
            'px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3',
            'max-w-[calc(100vw-2rem)]',
            className
          )}
        >
          {/* Selection count */}
          <div className="flex items-center gap-2 pr-0 sm:pr-3 border-b sm:border-b-0 sm:border-r pb-2 sm:pb-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClearSelection}
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium whitespace-nowrap">
              {selectedCount} selected
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
