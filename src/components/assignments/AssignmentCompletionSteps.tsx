import { ASSIGNMENT_STAGES, type AssignmentStage } from "@/lib/assignments/stages";

type Props = {
  stage: AssignmentStage;
  label: string;
};

type StepState = "completed" | "current" | "upcoming";

const STEPS = ["Started", "Exploration finished", "Quiz passed"] as const;
const STEP_STYLES: Record<StepState, { shape: string; text: string; description: string }> = {
  completed: { shape: "fill-accent stroke-accent", text: "text-accent-foreground", description: "completed" },
  current: { shape: "fill-accent/10 stroke-accent", text: "text-foreground", description: "current step" },
  upcoming: { shape: "fill-muted stroke-border", text: "text-muted-foreground", description: "not completed" },
};

export function AssignmentCompletionSteps({ stage, label }: Props) {
  const { completedSteps } = ASSIGNMENT_STAGES[stage];

  return (
    <ol aria-label={`${label}, assignment completion`} className="grid gap-1 sm:max-w-xl sm:grid-cols-3 sm:gap-0">
      {STEPS.map((step, index) => {
        const state: StepState = index < completedSteps ? "completed" : index === completedSteps ? "current" : "upcoming";
        const style = STEP_STYLES[state];
        return (
          <li
            key={step}
            aria-current={state === "current" ? "step" : undefined}
            className={`relative flex min-h-9 items-center justify-center px-4 py-2 text-center text-xs font-medium ${index > 0 ? "sm:-ml-4" : ""} ${style.text}`}
          >
            <svg viewBox="0 0 100 48" preserveAspectRatio="none" aria-hidden="true" className={`absolute inset-0 h-full w-full ${style.shape}`}>
              <polygon
                points={index === 0 ? "1,1 90,1 99,24 90,47 1,47" : "1,1 90,1 99,24 90,47 1,47 10,24"}
                strokeWidth="1.5"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span className="relative flex items-center justify-center gap-1">
              {state === "completed" && (
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-3.5 shrink-0">
                  <path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span>{step}</span>
              <span className="sr-only">, {style.description}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
