import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { addWeeks, format, startOfWeek } from 'date-fns';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export type TrendWeek = {
  weekStart: string;
  label: string;
  completed: number;
};

/**
 * Bucket completed-job timestamps into the last 8 calendar weeks (Monday
 * start). Pure client-side aggregation over one bounded select — the chart
 * renders only when at least 2 weeks have real data, so a sparse workspace
 * never sees a fake or empty chart.
 */
export function aggregateCompletedByWeek(timestamps: string[], now: Date): TrendWeek[] {
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weeks: TrendWeek[] = Array.from({ length: 8 }, (_, i) => {
    const weekStart = addWeeks(currentWeekStart, i - 7);
    return {
      weekStart: weekStart.toISOString(),
      label: format(weekStart, 'MMM d'),
      completed: 0,
    };
  });

  for (const ts of timestamps) {
    const bucketStart = startOfWeek(new Date(ts), { weekStartsOn: 1 }).toISOString();
    const bucket = weeks.find((w) => w.weekStart === bucketStart);
    if (bucket) bucket.completed += 1;
  }

  return weeks;
}

export function hasEnoughTrendData(weeks: TrendWeek[]): boolean {
  return weeks.filter((w) => w.completed > 0).length >= 2;
}

const chartConfig = {
  completed: {
    label: 'Completed',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

export function JobsTrendChart({ weeks, jobsLabel }: { weeks: TrendWeek[]; jobsLabel: string }) {
  return (
    <Card data-testid="dashboard-jobs-trend">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Completed {jobsLabel}
        </CardTitle>
        <p className="text-xs text-muted-foreground">Per week, last 8 weeks</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-48 w-full">
          <BarChart data={weeks} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              tickMargin={6}
              interval="preserveStartEnd"
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel={false} />} />
            <Bar
              dataKey="completed"
              fill="var(--color-completed)"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
