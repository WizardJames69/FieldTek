import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Thermometer,
  Gauge,
  Zap,
  Volume2,
  X,
  Droplet,
  CircleSlash,
  Flame,
  Power,
  AlertTriangle,
  Activity,
  Circle,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DIAGNOSTIC_PATHS,
  DiagnosticPath,
  DiagnosticStep,
  findDiagnosticPath,
  type IndustryType,
} from "@/config/industryAssistantConfig";

// Icon mapping for dynamic icon rendering
const ICON_MAP: Record<string, LucideIcon> = {
  Thermometer,
  Gauge,
  Zap,
  Volume2,
  Droplet,
  CircleSlash,
  Flame,
  Power,
  AlertTriangle,
  Activity,
  Circle,
};

interface DiagnosticWizardProps {
  symptomText: string;
  onComplete: (diagnosticData: Record<string, string>) => void;
  onCancel: () => void;
  industry?: IndustryType;
}

export function DiagnosticWizard({
  symptomText,
  onComplete,
  onCancel,
  industry,
}: DiagnosticWizardProps) {
  // Find matching diagnostic path based on symptom text and industry
  const matchingPath = useMemo(() => {
    return findDiagnosticPath(symptomText, industry);
  }, [symptomText, industry]);

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (!matchingPath) {
    return null;
  }

  const steps = matchingPath.steps;
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const canProceed = !step.required || answers[step.id];

  // Get the icon component
  const IconComponent = ICON_MAP[matchingPath.iconName] || Gauge;

  const handleAnswer = (value: string) => {
    setAnswers((prev) => ({ ...prev, [step.id]: value }));
  };

  const handleNext = () => {
    if (isLastStep) {
      onComplete({
        diagnosticType: matchingPath.id,
        diagnosticName: matchingPath.name,
        industry: matchingPath.industry,
        ...answers,
      });
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <Card className="p-4 border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <IconComponent className="h-4 w-4" />
          <span className="font-semibold text-sm">{matchingPath.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 mb-4">
        {steps.map((_, idx) => (
          <div
            key={idx}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              idx <= currentStep ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="font-medium text-sm">{step.title}</h4>
          <p className="text-xs text-muted-foreground">{step.description}</p>
        </div>

        {step.type === "choice" && step.options && (
          <RadioGroup
            value={answers[step.id] || ""}
            onValueChange={handleAnswer}
            className="space-y-2"
          >
            {step.options.map((option) => (
              <div
                key={option.value}
                className={cn(
                  "flex items-center space-x-2 rounded-lg border p-3 cursor-pointer transition-colors",
                  answers[step.id] === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
                onClick={() => handleAnswer(option.value)}
              >
                <RadioGroupItem value={option.value} id={option.value} />
                <Label htmlFor={option.value} className="flex-1 cursor-pointer text-sm">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {step.type === "measurement" && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={answers[step.id] || ""}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder={step.placeholder}
              className="flex-1"
            />
            {step.unit && (
              <span className="text-sm text-muted-foreground font-medium min-w-[40px]">
                {step.unit}
              </span>
            )}
          </div>
        )}

        {step.type === "text" && (
          <Textarea
            value={answers[step.id] || ""}
            onChange={(e) => handleAnswer(e.target.value)}
            placeholder={step.placeholder}
            rows={3}
          />
        )}

        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button size="sm" onClick={handleNext} disabled={!canProceed}>
            {isLastStep ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Submit to AI
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Re-export helper function for external use
export { findDiagnosticPath as getDiagnosticPath };

// Format diagnostic data for AI context
export function formatDiagnosticData(data: Record<string, string>): string {
  const lines: string[] = [];
  lines.push(`## Structured Diagnostic Data: ${data.diagnosticName || "Diagnostic"}`);
  
  if (data.industry && data.industry !== 'common') {
    lines.push(`Industry: ${data.industry.toUpperCase()}`);
  }
  
  lines.push("");

  for (const [key, value] of Object.entries(data)) {
    if (key === "diagnosticType" || key === "diagnosticName" || key === "industry") continue;

    // Format key to be human-readable
    const label = key
      .replace(/-/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    lines.push(`- **${label}**: ${value}`);
  }

  lines.push("");
  lines.push(
    "Please analyze these readings and observations. Reference documentation for specifications and guidance."
  );

  return lines.join("\n");
}
