import type { ReactNode } from "react";
import { ASSIGNMENT_STAGES, type AssignmentStage } from "@/lib/assignments/stages";

type Props = {
  stage: AssignmentStage;
  /** Names the bar for assistive technology, e.g. "Alex Kim, Bohr Model Intro". */
  label: string;
  /** Shown above the status and score, e.g. the student's name. */
  title: ReactNode;
  quizResult: ReactNode;
};

/**
 * One student's assignment status and quiz score above a 0/33/66/100%
 * completion bar. The bar tracks milestones, never the quiz percentage.
 */
export function AssignmentProgressHeader({ stage, label, title, quizResult }: Props) {
  const { percent, label: stageLabel, className } = ASSIGNMENT_STAGES[stage];
  return (
    <div className="space-y-3">
      <div className="font-medium text-foreground">{title}</div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-muted-foreground">Assignment status</dt>
          <dd className={className}>{stageLabel}</dd>
        </div>
        <div className="sm:text-right">
          <dt className="font-medium text-muted-foreground">Quiz score</dt>
          <dd className="text-foreground">{quizResult}</dd>
        </div>
      </dl>
      <div className="pt-7">
        <div
          role="progressbar"
          aria-label={`${label}, assignment completion`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={stageLabel}
          className="relative h-2 rounded-full bg-muted"
        >
          <span
            aria-hidden="true"
            className={`absolute bottom-full mb-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground tabular-nums transition-all motion-reduce:transition-none ${
              percent === 0 ? "translate-x-0" : percent === 100 ? "-translate-x-full" : "-translate-x-1/2"
            }`}
            style={{ left: `${percent}%` }}
          >
            {percent}%
          </span>
          <div className="h-full rounded-full bg-accent transition-all motion-reduce:transition-none" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}
