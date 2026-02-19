import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  Brain, 
  RefreshCw, 
  AlertTriangle, 
  Clock, 
  Wrench, 
  Package,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AIAnalysis {
  likely_issues: string[];
  required_skills: string[];
  estimated_time: number;
  possible_parts: string[];
  warranty_notes: string;
  urgency_assessment: 'critical' | 'high' | 'medium' | 'low';
  dispatch_notes: string;
  recommended_stage: 'startup' | 'service' | 'maintenance' | 'inspection';
}

interface AIAnalysisCardProps {
  requestId: string;
  title: string;
  description: string | null;
  requestType: string | null;
  existingAnalysis: AIAnalysis | null;
  analyzedAt: string | null;
  onAnalysisComplete?: () => void;
}

const urgencyColors = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-green-500 text-white',
};

const stageColors = {
  startup: 'bg-blue-100 text-blue-800 border-blue-200',
  service: 'bg-orange-100 text-orange-800 border-orange-200',
  maintenance: 'bg-green-100 text-green-800 border-green-200',
  inspection: 'bg-purple-100 text-purple-800 border-purple-200',
};

export function AIAnalysisCard({ 
  requestId, 
  title, 
  description, 
  requestType,
  existingAnalysis,
  analyzedAt,
  onAnalysisComplete
}: AIAnalysisCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(existingAnalysis);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(analyzedAt);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      // Get session for explicit auth header
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('analyze-service-request', {
        body: {
          requestId,
          title,
          description,
          request_type: requestType,
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setAnalysis(data.analysis);
      setLastAnalyzedAt(new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: ['service-requests'] });
      toast({ title: 'AI Analysis Complete' });
      onAnalysisComplete?.();
    },
    onError: (error) => {
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze request',
        variant: 'destructive',
      });
    },
  });

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <Card className="border-2 border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Pre-Screening
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : analysis ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Run Analysis
              </>
            )}
          </Button>
        </div>
        {lastAnalyzedAt && (
          <p className="text-xs text-muted-foreground">
            Last analyzed: {format(new Date(lastAnalyzedAt), 'PPp')}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {!analysis && !analyzeMutation.isPending && (
          <div className="text-center py-6 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Click "Run Analysis" to get AI-powered insights</p>
          </div>
        )}

        {analyzeMutation.isPending && (
          <div className="text-center py-6">
            <Loader2 className="h-12 w-12 mx-auto mb-2 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing service request...</p>
          </div>
        )}

        {analysis && !analyzeMutation.isPending && (
          <>
            {/* Urgency Badge */}
            <div className="flex items-center gap-2">
              <Badge className={urgencyColors[analysis.urgency_assessment]}>
                {analysis.urgency_assessment === 'critical' && <AlertCircle className="h-3 w-3 mr-1" />}
                {analysis.urgency_assessment.toUpperCase()} URGENCY
              </Badge>
              <Badge variant="outline" className={stageColors[analysis.recommended_stage]}>
                {analysis.recommended_stage.charAt(0).toUpperCase() + analysis.recommended_stage.slice(1)}
              </Badge>
            </div>

            {/* Likely Issues */}
            <div>
              <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Likely Issues
              </h5>
              <ul className="space-y-1">
                {analysis.likely_issues.map((issue, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>

            {/* Required Skills */}
            <div>
              <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-blue-500" />
                Required Skills
              </h5>
              <div className="flex flex-wrap gap-1">
                {analysis.required_skills.map((skill, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Estimated Time */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Estimated time: <strong>{formatTime(analysis.estimated_time)}</strong>
              </span>
            </div>

            {/* Possible Parts */}
            {analysis.possible_parts.length > 0 && (
              <div>
                <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Package className="h-4 w-4 text-green-500" />
                  Possible Parts Needed
                </h5>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {analysis.possible_parts.map((part, idx) => (
                    <li key={idx}>{part}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warranty Notes */}
            {analysis.warranty_notes && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <h5 className="text-sm font-medium text-orange-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Warranty Notes
                </h5>
                <p className="text-sm text-orange-700 mt-1">{analysis.warranty_notes}</p>
              </div>
            )}

            {/* Dispatch Notes */}
            <div className="bg-muted/50 rounded-lg p-3">
              <h5 className="text-sm font-medium mb-1 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Dispatch Notes
              </h5>
              <p className="text-sm text-muted-foreground">{analysis.dispatch_notes}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
