import type { ReactNode } from "react";
import { AssignmentCompletionSteps } from "@/components/assignments/AssignmentCompletionSteps";
import { ASSIGNMENT_STAGES, type AssignmentStage } from "@/lib/assignments/stages";

type Props = {
  stage: AssignmentStage;
  /** Names the completion steps for assistive technology, e.g. "Alex Kim, Bohr Model Intro". */
  label: string;
  /** Shown before the status, e.g. the student's name. */
  title: ReactNode;
  quizResult: ReactNode;
};

export function AssignmentProgressHeader({ stage, label, title, quizResult }: Props) {
  const { label: stageLabel, className } = ASSIGNMENT_STAGES[stage];
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {title}
          <span className={`text-sm ${className}`}>{stageLabel}</span>
        </div>
        <p className="text-sm text-muted-foreground">{quizResult}</p>
      </div>
      <p className="pt-2 text-sm font-medium text-muted-foreground">Assignment completion</p>
      <AssignmentCompletionSteps stage={stage} label={label} />
    </div>
  );
}
