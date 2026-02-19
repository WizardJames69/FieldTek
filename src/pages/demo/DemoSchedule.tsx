import { useState } from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  User,
  GripVertical,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDemoSandbox } from '@/contexts/DemoSandboxContext';
import { useTerminologyWithIndustry } from '@/hooks/useTerminology';
import { toast } from '@/hooks/use-toast';

export default function DemoSchedule() {
  const { getDemoJobs, getDemoClients, demoTeam, industry } = useDemoSandbox();
  const { t } = useTerminologyWithIndustry(industry);
  const [currentDate, setCurrentDate] = useState(new Date());

  const jobs = getDemoJobs();
  const clients = getDemoClients();
  const technicians = demoTeam.filter(m => m.role === 'technician');

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getJobsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return jobs.filter(j => j.scheduled_date === dateStr);
  };

  const getJobsForTechnicianAndDate = (techId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return jobs.filter(j => j.assigned_to === techId && j.scheduled_date === dateStr);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-blue-500 border-blue-600';
      case 'completed': return 'bg-green-500 border-green-600';
      case 'scheduled': return 'bg-yellow-500 border-yellow-600';
      case 'pending': return 'bg-gray-400 border-gray-500';
      default: return 'bg-gray-400 border-gray-500';
    }
  };

  const getPriorityIndicator = (priority: string) => {
    if (priority === 'urgent') return 'border-l-4 border-l-red-500';
    if (priority === 'high') return 'border-l-4 border-l-orange-500';
    return '';
  };

  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    e.dataTransfer.setData('jobId', jobId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, techId: string, date: Date) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData('jobId');
    const job = jobs.find(j => j.id === jobId);
    const tech = technicians.find(t => t.user_id === techId);
    
    toast({
      title: "Demo Mode",
      description: `In the full app, "${job?.title}" would be reassigned to ${tech?.name} on ${format(date, 'MMM d')}. Sign up to try it!`,
    });
  };

  // Get today's date for mobile view
  const today = new Date();

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">{t('schedule')}</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">Drag and drop to assign {t('jobs').toLowerCase()} to {t('technicians').toLowerCase()}</p>
          <p className="text-sm text-muted-foreground sm:hidden">Today's {t('jobs').toLowerCase()} by {t('technician').toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => setCurrentDate(addDays(currentDate, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-8 sm:h-10 text-sm" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => setCurrentDate(addDays(currentDate, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile View: Today's Jobs by Technician */}
      <div className="md:hidden space-y-4" data-tour="schedule-grid">
        {/* Wrapper for technician list - single element for tour highlighting */}
        <div data-tour="technician-list" className="space-y-4">
          {technicians.map(tech => {
            const todayJobs = getJobsForTechnicianAndDate(tech.user_id, today);
            return (
              <Card key={tech.id}>
                <CardContent className="p-3">
                  {/* Technician Header */}
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {tech.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{tech.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {todayJobs.length} {t('jobs').toLowerCase()} today
                      </p>
                    </div>
                  </div>
                  
                  {/* Jobs List */}
                  {todayJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">No {t('jobs').toLowerCase()} scheduled</p>
                  ) : (
                    <div className="space-y-2">
                      {todayJobs.map(job => {
                        const client = clients.find(c => c.id === job.client_id);
                        return (
                          <div
                            key={job.id}
                            className={`p-3 rounded-lg text-white ${getStatusColor(job.status)} ${getPriorityIndicator(job.priority)}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium">{job.title}</p>
                                <p className="text-sm opacity-80">{client?.name}</p>
                              </div>
                              <div className="flex items-center gap-1 text-xs opacity-80 flex-shrink-0">
                                <Clock className="h-3 w-3" />
                                <span>{job.scheduled_time}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Desktop View: Weekly Grid */}
      <Card data-tour="schedule-grid" className="hidden md:block overflow-hidden">
        <CardContent className="p-0">
          {/* Wrapper for technician list - single element for tour highlighting */}
          <div className="w-full" data-tour="technician-list">
            <div className="grid border-b" style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}>
              <div className="p-3 border-r bg-muted/30">
                <span className="text-sm font-medium text-muted-foreground">{t('technician')}</span>
              </div>
              {weekDays.map((day, i) => (
                <div
                  key={i}
                  className={`p-2 lg:p-3 text-center border-r last:border-r-0 ${
                    isSameDay(day, new Date()) ? 'bg-primary/10' : ''
                  }`}
                >
                  <p className="text-xs text-muted-foreground">{format(day, 'EEE')}</p>
                  <p className={`text-base lg:text-lg font-semibold ${
                    isSameDay(day, new Date()) ? 'text-primary' : ''
                  }`}>
                    {format(day, 'd')}
                  </p>
                </div>
              ))}
            </div>

            {/* Technician Rows */}
            <ScrollArea className="h-[500px]">
              {technicians.map(tech => (
                <div key={tech.id} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}>
                  {/* Technician Info */}
                  <div className="p-2 lg:p-3 border-r bg-muted/30 flex items-center gap-2 lg:gap-3">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-primary/20 flex items-center justify-center text-xs lg:text-sm font-medium flex-shrink-0">
                      {tech.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs lg:text-sm font-medium truncate">{tech.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getJobsForTechnicianAndDate(tech.user_id, currentDate).length} today
                      </p>
                    </div>
                  </div>

                  {/* Day Cells */}
                  {weekDays.map((day, i) => {
                    const dayJobs = getJobsForTechnicianAndDate(tech.user_id, day);
                    return (
                      <div
                        key={i}
                        className={`p-1 border-r last:border-r-0 min-h-[100px] ${
                          isSameDay(day, new Date()) ? 'bg-primary/5' : ''
                        }`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, tech.user_id, day)}
                      >
                        <div className="space-y-1">
                          {dayJobs.map(job => {
                            const client = clients.find(c => c.id === job.client_id);
                            return (
                              <div
                                key={job.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, job.id)}
                                className={`p-1.5 lg:p-2 rounded text-[10px] lg:text-xs cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity ${getStatusColor(job.status)} ${getPriorityIndicator(job.priority)} text-white group`}
                              >
                                <div className="flex items-start gap-1">
                                  <GripVertical className="h-3 w-3 opacity-50 group-hover:opacity-100 flex-shrink-0 mt-0.5 hidden lg:block" />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium truncate">{job.title}</p>
                                    <p className="opacity-80 truncate">{client?.name}</p>
                                    <div className="flex items-center gap-1 mt-1 opacity-80">
                                      <Clock className="h-3 w-3" />
                                      <span>{job.scheduled_time}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Unassigned Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Unassigned {t('jobs')}</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.filter(j => !j.assigned_to && j.status !== 'completed').length === 0 ? (
            <p className="text-center text-muted-foreground py-4">All {t('jobs').toLowerCase()} are assigned</p>
          ) : (
            <div className="grid gap-2 md:gap-3 md:grid-cols-2 lg:grid-cols-3">
              {jobs
                .filter(j => !j.assigned_to && j.status !== 'completed')
                .map(job => {
                  const client = clients.find(c => c.id === job.client_id);
                  return (
                    <Card key={job.id} className="cursor-grab hover:bg-muted/50">
                      <CardContent className="py-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{job.title}</p>
                            <p className="text-sm text-muted-foreground">{client?.name}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <CalendarIcon className="h-3 w-3" />
                              <span>{job.scheduled_date} {job.scheduled_time}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="capitalize text-xs">
                            {job.priority}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-500" />
          <span>Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-red-500" />
          <span>Urgent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-orange-500" />
          <span>High Priority</span>
        </div>
      </div>
    </div>
  );
}
