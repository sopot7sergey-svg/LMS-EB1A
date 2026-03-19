'use client';

interface DocumentBuilderStepperProps {
  steps: string[];
  currentStep: number;
  onStepChange: (step: number) => void;
}

export function DocumentBuilderStepper({
  steps,
  currentStep,
  onStepChange,
}: DocumentBuilderStepperProps) {
  return (
    <div className="grid gap-2 md:grid-cols-6">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isComplete = index < currentStep;

        return (
          <button
            key={step}
            type="button"
            onClick={() => onStepChange(index)}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
              isActive
                ? 'border-primary bg-primary/10 text-white'
                : isComplete
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-border bg-background-secondary text-foreground-secondary hover:border-border-hover'
            }`}
          >
            <div className="mb-1 font-medium">Шаг {String.fromCharCode(65 + index)}</div>
            <div>{step}</div>
          </button>
        );
      })}
    </div>
  );
}
