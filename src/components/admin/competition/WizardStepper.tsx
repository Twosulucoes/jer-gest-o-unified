import { cn } from "@/lib/utils";
import { Check, Lock, AlertCircle } from "lucide-react";
import type { StepStatusMap } from "@/hooks/useCollectiveStepStatus";

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
  stepStatus?: StepStatusMap;
}

function getStepState(
  step: WizardStep,
  isActive: boolean,
  isPast: boolean,
  completedSteps: string[],
  stepStatus?: StepStatusMap
) {
  // If stepStatus map is provided, use it (collective flow)
  if (stepStatus && stepStatus[step.key]) {
    const ss = stepStatus[step.key].status;
    if (isActive) return "active";
    return ss; // completed | partial | blocked | available
  }
  // Legacy fallback (individual flow)
  if (isActive) return "active";
  if (completedSteps.includes(step.key)) return "completed";
  if (isPast) return "completed";
  return "available";
}

// Circle styles per state
function circleClasses(state: string) {
  switch (state) {
    case "active":
      return "border-primary bg-primary text-primary-foreground";
    case "completed":
      return "border-green-500/60 bg-green-500/15 text-green-600 dark:text-green-400";
    case "partial":
      return "border-yellow-500/60 bg-yellow-500/15 text-yellow-600 dark:text-yellow-400";
    case "blocked":
      return "border-muted-foreground/20 bg-muted/50 text-muted-foreground/40";
    default:
      return "border-muted-foreground/30 text-muted-foreground/50";
  }
}

function labelClasses(state: string) {
  switch (state) {
    case "active":
      return "text-primary";
    case "completed":
      return "text-green-600 dark:text-green-400";
    case "partial":
      return "text-yellow-600 dark:text-yellow-400";
    case "blocked":
      return "text-muted-foreground/40";
    default:
      return "text-muted-foreground/60 hover:text-muted-foreground";
  }
}

function lineClasses(state: string) {
  switch (state) {
    case "completed":
      return "bg-green-500/30";
    case "partial":
      return "bg-yellow-500/30";
    default:
      return "bg-border";
  }
}

function StepIcon({ state, idx }: { state: string; idx: number }) {
  if (state === "completed") return <Check className="h-3.5 w-3.5" />;
  if (state === "blocked") return <Lock className="h-3 w-3" />;
  if (state === "partial") return <AlertCircle className="h-3 w-3" />;
  return <>{idx + 1}</>;
}

export default function WizardStepper({ steps, currentStep, onStepClick, completedSteps = [], stepStatus }: Props) {
  const visibleSteps = steps.filter((s) => !s.hidden);
  const currentIdx = visibleSteps.findIndex((s) => s.key === currentStep);

  return (
    <nav className="w-full">
      {/* Desktop */}
      <ol className="hidden md:flex items-center w-full">
        {visibleSteps.map((step, idx) => {
          const isActive = step.key === currentStep;
          const isPast = idx < currentIdx;
          const state = getStepState(step, isActive, isPast, completedSteps, stepStatus);

          return (
            <li key={step.key} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => onStepClick(step.key)}
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap",
                  labelClasses(state)
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-full border-2 text-xs font-bold shrink-0 transition-colors",
                    circleClasses(state)
                  )}
                >
                  <StepIcon state={state} idx={idx} />
                </span>
                {step.label}
              </button>
              {idx < visibleSteps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-px mx-3",
                    lineClasses(state)
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
          const isPast = idx < currentIdx;
          const state = getStepState(step, isActive, isPast, completedSteps, stepStatus);

          return (
            <button
              key={step.key}
              onClick={() => onStepClick(step.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors",
                state === "active"
                  ? "border-primary bg-primary text-primary-foreground"
                  : state === "completed"
                    ? "border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400"
                    : state === "partial"
                      ? "border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400"
                      : state === "blocked"
                        ? "border-muted/50 bg-muted/30 text-muted-foreground/40"
                        : "border-border text-muted-foreground"
              )}
            >
              {state === "completed" && <Check className="h-3 w-3" />}
              {state === "blocked" && <Lock className="h-3 w-3" />}
              {step.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
