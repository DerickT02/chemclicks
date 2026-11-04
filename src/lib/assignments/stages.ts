// Where a student is within one assignment, as derived on the server by
// public.assignment_progress_state. 'completed' follows the shared completion
// rule (isSectionComplete): the quiz is passed, or, for an activity without a
// quiz, the exploration is finished.
export type AssignmentStage =
  | "not_started"
  | "exploring"
  | "explored"
  | "quiz_in_progress"
  | "needs_retry"
  | "completed";

// Three steps on the bar: start the assignment, start the quiz, finish the quiz.
export const ASSIGNMENT_STAGES: Record<
  AssignmentStage,
  { percent: number; label: string; className: string }
> = {
  not_started: { percent: 0, label: "Not started", className: "text-muted-foreground" },
  exploring: { percent: 33, label: "Started the assignment", className: "text-foreground" },
  explored: { percent: 33, label: "Exploration finished, quiz not started", className: "text-foreground" },
  quiz_in_progress: { percent: 66, label: "Taking the quiz", className: "text-foreground" },
  needs_retry: { percent: 66, label: "Quiz not passed, needs retry", className: "text-destructive" },
  completed: { percent: 100, label: "Completed", className: "text-accent" },
};

/** Whether the student has started the quiz at least once by this stage. */
export function hasReachedQuiz(stage: AssignmentStage): boolean {
  return stage === "quiz_in_progress" || stage === "needs_retry";
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.trunc(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}
