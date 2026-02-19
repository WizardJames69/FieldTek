import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number;
  category: string;
  feature_key: string | null;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface TutorialProgress {
  id: string;
  user_id: string;
  tutorial_id: string;
  watched_at: string;
  completed: boolean;
  watch_duration_seconds: number;
}

export interface TutorialWithProgress extends Tutorial {
  progress?: TutorialProgress | null;
  isWatched: boolean;
  isCompleted: boolean;
}

export function useTutorials() {
  return useQuery({
    queryKey: ['tutorials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorials')
        .select('*')
        .eq('is_published', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as Tutorial[];
    },
  });
}

export function useTutorialsByCategory() {
  const { data: tutorials, ...rest } = useTutorials();

  const grouped = tutorials?.reduce((acc, tutorial) => {
    const category = tutorial.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(tutorial);
    return acc;
  }, {} as Record<string, Tutorial[]>);

  return { data: grouped, tutorials, ...rest };
}

export function useTutorialByFeature(featureKey: string | null) {
  return useQuery({
    queryKey: ['tutorial', 'feature', featureKey],
    queryFn: async () => {
      if (!featureKey) return null;
      
      const { data, error } = await supabase
        .from('tutorials')
        .select('*')
        .eq('feature_key', featureKey)
        .eq('is_published', true)
        .maybeSingle();

      if (error) throw error;
      return data as Tutorial | null;
    },
    enabled: !!featureKey,
  });
}

export function useTutorialProgress() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['tutorial-progress', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('user_tutorial_progress')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as TutorialProgress[];
    },
    enabled: !!user?.id,
  });
}

export function useTutorialsWithProgress() {
  const { data: tutorials, isLoading: tutorialsLoading } = useTutorials();
  const { data: progress, isLoading: progressLoading } = useTutorialProgress();

  const tutorialsWithProgress: TutorialWithProgress[] = tutorials?.map(tutorial => {
    const tutorialProgress = progress?.find(p => p.tutorial_id === tutorial.id);
    return {
      ...tutorial,
      progress: tutorialProgress || null,
      isWatched: !!tutorialProgress,
      isCompleted: tutorialProgress?.completed || false,
    };
  }) || [];

  return {
    data: tutorialsWithProgress,
    isLoading: tutorialsLoading || progressLoading,
  };
}

export function useMarkTutorialWatched() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ tutorialId, completed = false, watchDuration = 0 }: {
      tutorialId: string;
      completed?: boolean;
      watchDuration?: number;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('user_tutorial_progress')
        .upsert({
          user_id: user.id,
          tutorial_id: tutorialId,
          completed,
          watch_duration_seconds: watchDuration,
          watched_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,tutorial_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorial-progress'] });
    },
  });
}

export function useCompletedTutorialCount() {
  const { data: progress } = useTutorialProgress();
  const { data: tutorials } = useTutorials();

  const completedCount = progress?.filter(p => p.completed).length || 0;
  const totalCount = tutorials?.length || 0;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return { completedCount, totalCount, percentage };
}

// Category display names
export const TUTORIAL_CATEGORIES: Record<string, string> = {
  'getting-started': 'Getting Started',
  'jobs': 'Jobs & Work Orders',
  'scheduling': 'Scheduling',
  'ai': 'AI Assistant',
  'advanced': 'Advanced Features',
  'documents': 'Documents',
  'invoicing': 'Invoicing',
  'portal': 'Customer Portal',
  'team': 'Team Management',
  'settings': 'Settings',
};

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}
