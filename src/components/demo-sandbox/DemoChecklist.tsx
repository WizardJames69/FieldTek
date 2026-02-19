import { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  Calendar,
  Briefcase,
  FileText,
  Bot,
  Users,
  Wrench,
  Inbox,
  Trophy,
  CheckSquare,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useDemoSandbox } from '@/contexts/DemoSandboxContext';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Calendar,
  Briefcase,
  FileText,
  Bot,
  Users,
  Wrench,
  Inbox,
  CheckSquare,
  Search,
};

interface DemoChecklistProps {
  onNavigate?: () => void;
}

export function DemoChecklist({ onNavigate }: DemoChecklistProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { featureChecklist, featuresExplored, checklistProgress } = useDemoSandbox();
  const [isExpanded, setIsExpanded] = useState(true);

  const sessionToken = searchParams.get('session');
  const isComplete = checklistProgress === 100;

  // Transform feature path to demo route with session token
  const getDemoPath = (path: string) => {
    const demoPath = `/demo${path}`;
    return sessionToken ? `${demoPath}?session=${sessionToken}` : demoPath;
  };

  const handleFeatureClick = (path: string) => {
    navigate(getDemoPath(path));
    onNavigate?.();
  };

  return (
    <Card className="shadow-lg border-primary/20" data-tour="checklist">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {isComplete ? (
              <Trophy className="h-5 w-5 text-yellow-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            )}
            {isComplete ? 'All Explored!' : 'Features to Try'}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="space-y-1">
          <Progress value={checklistProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {featuresExplored.length} of {featureChecklist.length} explored
          </p>
        </div>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0">
              <div className="space-y-1">
                {featureChecklist.map((feature) => {
                  const isExplored = featuresExplored.includes(feature.id);
                  const isCurrent = location.pathname === `/demo${feature.path}`;
                  const Icon = ICON_MAP[feature.icon] || Circle;

                  return (
                    <button
                      key={feature.id}
                      onClick={() => handleFeatureClick(feature.path)}
                      className={cn(
                        'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
                        isCurrent && 'bg-primary/10',
                        !isCurrent && 'hover:bg-muted',
                        isExplored && 'opacity-70'
                      )}
                    >
                      <div
                        className={cn(
                          'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
                          isExplored
                            ? 'bg-green-100 text-green-600'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {isExplored ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium truncate',
                            isExplored && 'line-through text-muted-foreground'
                          )}
                        >
                          {feature.label}
                        </p>
                      </div>
                      {isCurrent && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>

              {isComplete && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200"
                >
                  <p className="text-sm font-medium text-yellow-800 mb-2">
                    🎉 You've explored everything!
                  </p>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => navigate('/?waitlist=open')}
                  >
                    Join Waitlist
                  </Button>
                </motion.div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
