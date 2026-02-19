import { Badge } from "@/components/ui/badge";
import { BookOpen, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface DocumentCitationProps {
  sources: string[];
  onSourceClick?: (sourceName: string) => void;
  className?: string;
}

export function DocumentCitation({
  sources,
  onSourceClick,
  className,
}: DocumentCitationProps) {
  const navigate = useNavigate();

  if (sources.length === 0) return null;

  const handleClick = (source: string) => {
    if (onSourceClick) {
      onSourceClick(source);
    } else {
      // Navigate to documents page with search query
      navigate(`/documents?search=${encodeURIComponent(source)}`);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {sources.map((source, idx) => (
        <Badge
          key={idx}
          variant="outline"
          className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 cursor-pointer hover:bg-emerald-500/20 transition-colors"
          onClick={() => handleClick(source)}
        >
          <BookOpen className="h-3 w-3" />
          {source}
          <ExternalLink className="h-2.5 w-2.5 opacity-60" />
        </Badge>
      ))}
    </div>
  );
}

interface ContextIndicatorProps {
  jobTitle?: string;
  equipmentType?: string;
  documentCount: number;
  onClearContext?: () => void;
  className?: string;
}

export function ContextIndicator({
  jobTitle,
  equipmentType,
  documentCount,
  onClearContext,
  className,
}: ContextIndicatorProps) {
  const hasContext = jobTitle || equipmentType || documentCount > 0;

  if (!hasContext) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5",
        className
      )}
    >
      <span className="font-medium">Context:</span>
      {jobTitle && (
        <Badge variant="secondary" className="text-xs h-5">
          {jobTitle}
        </Badge>
      )}
      {equipmentType && (
        <Badge variant="outline" className="text-xs h-5">
          {equipmentType}
        </Badge>
      )}
      {documentCount > 0 && (
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {documentCount} doc{documentCount !== 1 ? "s" : ""}
        </span>
      )}
      {onClearContext && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-xs ml-auto"
          onClick={onClearContext}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
