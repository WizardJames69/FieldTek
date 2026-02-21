import { useTechnicianTutorial } from '@/hooks/useTechnicianTutorial';
import { TechnicianDashboard } from '@/components/dashboard/TechnicianDashboard';
import { TechnicianTutorial } from './TechnicianTutorial';

export function TechnicianTutorialGate() {
  const { shouldShowTutorial, completeTutorial, skipTutorial } = useTechnicianTutorial();

  if (shouldShowTutorial) {
    return <TechnicianTutorial onComplete={completeTutorial} onSkip={skipTutorial} />;
  }

  return <TechnicianDashboard />;
}
