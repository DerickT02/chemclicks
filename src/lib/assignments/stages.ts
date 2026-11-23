// Where a student is within one assignment, as derived on the server by
// public.assignment_progress_state. 'completed' follows the shared completion
// rule (isSectionComplete): exploration and its quiz are both complete, or
// exploration is complete for activities without a quiz.
export type AssignmentStage =
  | "not_started"
  | "exploring"
  | "explored"
  | "quiz_in_progress"
  | "needs_retry"
  | "completed";

export const ASSIGNMENT_STAGES: Record<
  AssignmentStage,
  { completedSteps: 0 | 1 | 2 | 3; label: string; className: string }
> = {
  not_started: { completedSteps: 0, label: "Not started", className: "text-muted-foreground" },
  exploring: { completedSteps: 1, label: "Started the assignment", className: "text-foreground" },
  explored: { completedSteps: 2, label: "Exploration finished, quiz not started", className: "text-foreground" },
  quiz_in_progress: { completedSteps: 2, label: "Taking the quiz", className: "text-foreground" },
  needs_retry: { completedSteps: 2, label: "Quiz not passed, needs retry", className: "text-destructive" },
  completed: { completedSteps: 3, label: "Completed", className: "text-accent" },
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
