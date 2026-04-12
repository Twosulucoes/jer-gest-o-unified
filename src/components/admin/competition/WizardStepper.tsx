import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface WizardStep {
  key: string;
  label: string;
  icon?: React.ReactNode;
  hidden?: boolean;
}

interface Props {
  steps: WizardStep[];
  currentStep: string;
  onStepClick: (key: string) => void;
  completedSteps?: string[];
}

export default function WizardStepper({ steps, currentStep, onStepClick, completedSteps = [] }: Props) {
  const visibleSteps = steps.filter((s) => !s.hidden);
  const currentIdx = visibleSteps.findIndex((s) => s.key === currentStep);

  return (
    <nav className="w-full">
      {/* Desktop */}
      <ol className="hidden md:flex items-center w-full">
        {visibleSteps.map((step, idx) => {
          const isActive = step.key === currentStep;
          const isCompleted = completedSteps.includes(step.key);
          const isPast = idx < currentIdx;

          return (
            <li key={step.key} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => onStepClick(step.key)}
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "text-primary"
                    : isPast || isCompleted
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/60 hover:text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-full border-2 text-xs font-bold shrink-0 transition-colors",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCompleted
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground/50"
                  )}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </span>
                {step.label}
              </button>
              {idx < visibleSteps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-px mx-3",
                    isPast || isCompleted ? "bg-primary/30" : "bg-border"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-2">
        {visibleSteps.map((step, idx) => {
          const isActive = step.key === currentStep;
          const isCompleted = completedSteps.includes(step.key);

          return (
            <button
              key={step.key}
              onClick={() => onStepClick(step.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : isCompleted
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : "border-border text-muted-foreground"
              )}
            >
              {isCompleted && <Check className="h-3 w-3" />}
              {step.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
