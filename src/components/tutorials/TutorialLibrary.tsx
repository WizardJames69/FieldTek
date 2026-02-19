import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  PlayCircle, 
  CheckCircle2, 
  Clock, 
  Video,
  BookOpen,
  Wrench,
  Calendar,
  Bot,
  FileText,
  Receipt,
  Users,
  Settings,
  Globe,
  Sparkles
} from 'lucide-react';
import { 
  useTutorialsByCategory, 
  useTutorialProgress, 
  useCompletedTutorialCount,
  formatDuration,
  TUTORIAL_CATEGORIES,
  Tutorial 
} from '@/hooks/useTutorialProgress';
import { TutorialVideoDialog } from './TutorialVideoDialog';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'getting-started': <BookOpen className="h-4 w-4" />,
  'jobs': <Wrench className="h-4 w-4" />,
  'scheduling': <Calendar className="h-4 w-4" />,
  'ai': <Bot className="h-4 w-4" />,
  'advanced': <Sparkles className="h-4 w-4" />,
  'documents': <FileText className="h-4 w-4" />,
  'invoicing': <Receipt className="h-4 w-4" />,
  'portal': <Globe className="h-4 w-4" />,
  'team': <Users className="h-4 w-4" />,
  'settings': <Settings className="h-4 w-4" />,
};

export function TutorialLibrary() {
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: categorizedTutorials, tutorials, isLoading } = useTutorialsByCategory();
  const { data: progress } = useTutorialProgress();
  const { completedCount, totalCount, percentage } = useCompletedTutorialCount();

  const isCompleted = (tutorialId: string) => {
    return progress?.some(p => p.tutorial_id === tutorialId && p.completed) || false;
  };

  const handleTutorialClick = (tutorial: Tutorial) => {
    setSelectedTutorial(tutorial);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const categories = Object.keys(categorizedTutorials || {});

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Your Progress</CardTitle>
              <CardDescription>
                {completedCount} of {totalCount} tutorials completed
              </CardDescription>
            </div>
            <Badge variant={percentage === 100 ? 'default' : 'secondary'} className="text-lg px-3 py-1">
              {percentage}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={percentage} className="h-2" />
        </CardContent>
      </Card>

      {/* Tutorial Categories */}
      <Tabs defaultValue={categories[0]} className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1 bg-transparent p-0">
          {categories.map((category) => (
            <TabsTrigger
              key={category}
              value={category}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {CATEGORY_ICONS[category]}
              <span className="ml-1 hidden sm:inline">{TUTORIAL_CATEGORIES[category] || category}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category} value={category} className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categorizedTutorials?.[category]?.map((tutorial) => {
                const completed = isCompleted(tutorial.id);
                const hasVideo = !!tutorial.video_url;

                return (
                  <Card
                    key={tutorial.id}
                    className={`cursor-pointer transition-all hover:shadow-md relative overflow-hidden ${
                      completed ? 'border-green-500/30 bg-green-500/5' : ''
                    } ${!hasVideo ? 'opacity-90' : ''}`}
                    onClick={() => handleTutorialClick(tutorial)}
                  >
                    {/* Coming Soon Overlay */}
                    {!hasVideo && !completed && (
                      <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-muted/30 backdrop-blur-[1px] flex items-center justify-center z-10 pointer-events-none">
                        <div className="bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border shadow-sm">
                          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/80"></span>
                            </span>
                            Recording in Progress
                          </span>
                        </div>
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {completed ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                          ) : hasVideo ? (
                            <PlayCircle className="h-5 w-5 text-primary flex-shrink-0" />
                          ) : (
                            <Video className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}
                          <CardTitle className="text-base leading-tight">
                            {tutorial.title}
                          </CardTitle>
                        </div>
                        {!hasVideo && (
                          <Badge variant="secondary" className="text-xs bg-muted/80 flex-shrink-0">
                            Soon
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {tutorial.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {tutorial.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(tutorial.duration_seconds)}
                        </span>
                        {hasVideo && !completed && (
                          <Badge variant="outline" className="text-xs text-primary border-primary/30">
                            Ready to Watch
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <TutorialVideoDialog
        tutorial={selectedTutorial}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
