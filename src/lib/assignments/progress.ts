import type { AssignmentStage } from "@/lib/assignments/stages";

/** Saved timing and result facts for one student's assignment. */
export type AssignmentProgressFacts = {
  stage: AssignmentStage;
  explorationStartedAt: string | null;
  firstQuizStartedAt: string | null;
  timeToFirstQuizSeconds: number | null;
  passingQuizAttemptNumber: number | null;
  passingQuizScore: number | null;
  passingQuizTotal: number | null;
  passingQuizPercentage: number | null;
  failedQuizAttemptCount: number;
  completedAt: string | null;
};

const STAGE_FROM_STATUS = {
  not_started: "not_started",
  in_progress: "exploring",
  exploring: "exploring",
  taking_quiz: "quiz_in_progress",
  needs_retry: "needs_retry",
  completed: "completed",
} as const satisfies Record<string, AssignmentStage>;

/** Normalize old RPC responses at the server boundary, not in individual views. */
export function normalizeAssignmentProgress(
  facts: Partial<AssignmentProgressFacts>,
  status: keyof typeof STAGE_FROM_STATUS,
): AssignmentProgressFacts {
  return {
    stage: facts.stage ?? STAGE_FROM_STATUS[status],
    explorationStartedAt: facts.explorationStartedAt ?? null,
    firstQuizStartedAt: facts.firstQuizStartedAt ?? null,
    timeToFirstQuizSeconds: facts.timeToFirstQuizSeconds ?? null,
    passingQuizAttemptNumber: facts.passingQuizAttemptNumber ?? null,
    passingQuizScore: facts.passingQuizScore ?? null,
    passingQuizTotal: facts.passingQuizTotal ?? null,
    passingQuizPercentage: facts.passingQuizPercentage ?? null,
    failedQuizAttemptCount: facts.failedQuizAttemptCount ?? 0,
    completedAt: facts.completedAt ?? null,
  };
}
