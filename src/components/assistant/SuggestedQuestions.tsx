import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuggestedQuestionsProps {
  suggestions: string[];
  onSelect: (question: string) => void;
  disabled?: boolean;
  className?: string;
}

export function SuggestedQuestions({
  suggestions,
  onSelect,
  disabled = false,
  className,
}: SuggestedQuestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-full mb-1">
        <Lightbulb className="h-3 w-3" />
        <span>Follow-up questions</span>
      </div>
      {suggestions.map((suggestion, idx) => (
        <Button
          key={idx}
          variant="outline"
          size="sm"
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
          className="text-xs h-7 px-2.5 bg-muted/30 hover:bg-muted/50 border-muted-foreground/20"
        >
          {suggestion}
        </Button>
      ))}
    </div>
  );
}

// Generate follow-up suggestions based on AI response content and context
export function generateSuggestions(
  responseText: string,
  hasEquipment: boolean,
  hasDocuments: boolean
): string[] {
  const suggestions: string[] = [];
  const lowerText = responseText.toLowerCase();

  // Detect topics in the response to generate relevant follow-ups
  const topicPatterns: { pattern: RegExp; questions: string[] }[] = [
    {
      pattern: /warranty|coverage|claim/i,
      questions: [
        "What's covered under warranty?",
        "How do I file a warranty claim?",
      ],
    },
    {
      pattern: /pressure|psi|refrigerant/i,
      questions: [
        "What are the normal pressure ranges?",
        "How do I check for leaks?",
      ],
    },
    {
      pattern: /filter|airflow|dirty/i,
      questions: [
        "How often should filters be replaced?",
        "What filter type is recommended?",
      ],
    },
    {
      pattern: /error|fault|code/i,
      questions: [
        "What does this error code mean?",
        "How do I clear the fault?",
      ],
    },
    {
      pattern: /motor|fan|blower/i,
      questions: [
        "How do I test the motor?",
        "What's the part number for replacement?",
      ],
    },
    {
      pattern: /thermostat|control|board/i,
      questions: [
        "How do I calibrate the thermostat?",
        "What settings are recommended?",
      ],
    },
    {
      pattern: /capacitor|contactor|relay/i,
      questions: [
        "How do I test the capacitor?",
        "What are the symptoms of a bad contactor?",
      ],
    },
    {
      pattern: /maintenance|service|inspection/i,
      questions: [
        "What's the maintenance schedule?",
        "What should I check during inspection?",
      ],
    },
    {
      pattern: /install|startup|commission/i,
      questions: [
        "What are the startup procedures?",
        "What should I verify after installation?",
      ],
    },
    {
      pattern: /noise|loud|vibrat/i,
      questions: [
        "What could cause this noise?",
        "How do I isolate the source?",
      ],
    },
    {
      pattern: /leak|water|condensate/i,
      questions: [
        "How do I check the drain line?",
        "What causes condensate issues?",
      ],
    },
  ];

  // Find matching topics and add relevant questions
  for (const { pattern, questions } of topicPatterns) {
    if (pattern.test(lowerText) && suggestions.length < 3) {
      for (const q of questions) {
        if (suggestions.length < 3 && !suggestions.includes(q)) {
          suggestions.push(q);
        }
      }
    }
  }

  // Add context-aware generic suggestions if we don't have enough
  if (suggestions.length < 2) {
    if (hasEquipment) {
      if (!suggestions.some((s) => s.includes("history"))) {
        suggestions.push("What's the service history pattern?");
      }
    }
    if (hasDocuments && suggestions.length < 3) {
      if (!suggestions.some((s) => s.includes("document"))) {
        suggestions.push("What other documentation is available?");
      }
    }
  }

  // Fallback generic questions
  if (suggestions.length === 0) {
    if (hasDocuments) {
      suggestions.push("What maintenance is documented?");
      suggestions.push("What specs are in the manuals?");
    }
  }

  return suggestions.slice(0, 3);
}
