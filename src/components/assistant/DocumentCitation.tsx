import { Badge } from "@/components/ui/badge";
import { BookOpen, ExternalLink, FileText, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { resolveDocumentSignedUrl } from "@/lib/documentLinks";

/** Structured citation from the assistant's response metadata. */
export interface CitationSource {
  document_id?: string | null;
  document_name: string;
  page_number?: number | null;
  section_name?: string | null;
  similarity?: number;
  /** "lesson" for published-approved-lesson sources; "document" otherwise. */
  source_type?: "lesson" | "document";
}

interface DocumentCitationProps {
  /** Legacy name-only sources (regex-parsed [Source: Name] markers). */
  sources?: string[];
  /** Structured sources from response metadata — preferred when present. */
  citations?: CitationSource[];
  onSourceClick?: (sourceName: string) => void;
  className?: string;
}

const BADGE_CLASS =
  "text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 cursor-pointer hover:bg-emerald-500/20 transition-colors";

// Lesson-sourced citations get a distinct, non-clickable style — they have no
// uploaded file (file_url is null) so there is no PDF to open.
const LESSON_BADGE_CLASS =
  "text-xs bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 flex items-center gap-1";

export function DocumentCitation({
  sources,
  citations,
  onSourceClick,
  className,
}: DocumentCitationProps) {
  const navigate = useNavigate();

  // Structured citations (document + page + section) take priority.
  if (citations && citations.length > 0) {
    const handleCitationClick = async (c: CitationSource) => {
      if (c.document_id) {
        const url = await resolveDocumentSignedUrl(c.document_id, c.page_number ?? null);
        if (url) {
          window.open(url, "_blank");
          return;
        }
      }
      // No document_id, or the signed URL could not be resolved.
      navigate(`/documents?search=${encodeURIComponent(c.document_name)}`);
    };

    return (
      <div data-testid="document-citation" className={cn("flex flex-wrap gap-1.5", className)}>
        {citations.map((c, idx) => {
          const label =
            c.page_number != null ? `${c.document_name} · p.${c.page_number}` : c.document_name;

          // Lesson-sourced citation: clearly labeled "Approved Lesson", no PDF
          // link (no file to open), not clickable.
          if (c.source_type === "lesson") {
            return (
              <Badge
                key={idx}
                variant="outline"
                title={c.section_name ?? undefined}
                className={LESSON_BADGE_CLASS}
                data-testid="lesson-citation"
              >
                <GraduationCap className="h-3 w-3" />
                <span className="font-medium">Approved Lesson</span>
                <span className="opacity-70">· {label}</span>
              </Badge>
            );
          }

          return (
            <Badge
              key={idx}
              variant="outline"
              title={c.section_name ?? undefined}
              className={BADGE_CLASS}
              onClick={() => handleCitationClick(c)}
            >
              <BookOpen className="h-3 w-3" />
              {label}
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </Badge>
          );
        })}
      </div>
    );
  }

  // Legacy name-only fallback (old response shapes / regex markers).
  if (!sources || sources.length === 0) return null;

  const handleClick = (source: string) => {
    if (onSourceClick) {
      onSourceClick(source);
    } else {
      // Navigate to documents page with search query
      navigate(`/documents?search=${encodeURIComponent(source)}`);
    }
  };

  return (
    <div data-testid="document-citation" className={cn("flex flex-wrap gap-1.5", className)}>
      {sources.map((source, idx) => (
        <Badge
          key={idx}
          variant="outline"
          className={BADGE_CLASS}
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
          data-testid="clear-job-context"
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
