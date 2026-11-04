import type { ReactNode } from "react";
import { ASSIGNMENT_STAGES, type AssignmentStage } from "@/lib/assignments/stages";

type Props = {
  stage: AssignmentStage;
  /** Names the bar for assistive technology, e.g. "Alex Kim, Bohr Model Intro". */
  label: string;
  /** Shown above the bar on the left, e.g. the student's name. */
  title: ReactNode;
};

/** One assignment's stage as a labelled 0/33/66/100% bar. */
export function StageBar({ stage, label, title }: Props) {
  const { percent, label: stageLabel, className } = ASSIGNMENT_STAGES[stage];
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <div className="font-medium text-foreground">{title}</div>
        <span className={className}>
          {stageLabel} · {percent}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={stageLabel}
        className="h-2 rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
