import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

export interface StepIndicatorProps {
  steps: string[];
  /** 1-based index of the currently active step. */
  currentStep: number;
}

/**
 * Wizard step-pill row (booking wizard, walk-in wizard, etc.). Preserves the
 * one genuinely-correct mobile pattern found in the original export:
 * horizontal scroll with a hidden scrollbar, rather than wrapping/squeezing.
 */
export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="hide-scrollbar mb-xl flex items-center overflow-x-auto py-sm">
      <div className="flex min-w-max items-center space-x-md">
        {steps.map((label, i) => {
          const stepNumber = i + 1;
          const isActive = stepNumber === currentStep;
          const isComplete = stepNumber < currentStep;
          return (
            <div key={label} className="flex items-center space-x-md">
              {i > 0 && <div className="h-px w-8 bg-outline-variant" />}
              <div className={cn("flex items-center gap-xs", !isActive && !isComplete && "opacity-50")}>
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-label-md font-bold",
                    isActive && "bg-primary text-on-primary shadow-md",
                    isComplete && "bg-primary-container text-on-primary-container",
                    !isActive && !isComplete && "bg-surface-container-high text-on-surface",
                  )}
                >
                  {isComplete ? <Icon name="check" className="text-[16px]" /> : stepNumber}
                </span>
                <span className={cn("text-label-md", isActive && "font-bold text-primary")}>{label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
