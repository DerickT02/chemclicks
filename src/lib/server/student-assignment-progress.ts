import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Canonical server-derived state for one assignment in a student's class. */
export type StudentAssignmentProgressState = {
  assignmentId: string;
  status: string;
  stage: string;
  explorationCompleted: boolean;
  explorationCompletedAt: string | null;
  passingAttemptNumber: number | null;
  passingScore: number | null;
  passingTotal: number | null;
  passingPercentage: number | null;
  passingQuizKey: string | null;
  passingCompletedAt: string | null;
  failedQuizAttemptCount: number;
  completedAt: string | null;
};

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableNumber(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Assignment progress is unavailable.");
  }
  return value;
}

function nullableInteger(value: unknown): number | null {
  const number = nullableNumber(value);
  if (number !== null && !Number.isInteger(number)) {
    throw new Error("Assignment progress is unavailable.");
  }
  return number;
}

function nullableString(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Assignment progress is unavailable.");
  return value;
}

function parseRow(value: unknown): StudentAssignmentProgressState {
  if (!isRow(value)
    || typeof value.assignment_id !== "string"
    || typeof value.status !== "string"
    || typeof value.stage !== "string"
    || typeof value.exploration_completed !== "boolean"
    || typeof value.failed_quiz_attempt_count !== "number"
    || !Number.isInteger(value.failed_quiz_attempt_count)
    || value.failed_quiz_attempt_count < 0) {
    throw new Error("Assignment progress is unavailable.");
  }

  return {
    assignmentId: value.assignment_id,
    status: value.status,
    stage: value.stage,
    explorationCompleted: value.exploration_completed,
    explorationCompletedAt: nullableString(value.exploration_completed_at),
    passingAttemptNumber: nullableInteger(value.passing_attempt_number),
    passingScore: nullableInteger(value.passing_score),
    passingTotal: nullableInteger(value.passing_total),
    passingPercentage: nullableNumber(value.passing_percentage),
    passingQuizKey: nullableString(value.passing_quiz_key),
    passingCompletedAt: nullableString(value.passing_completed_at),
    failedQuizAttemptCount: value.failed_quiz_attempt_count,
    completedAt: nullableString(value.completed_at),
  };
}

/**
 * Read assignment states for the authenticated student's own assignments.
 * The database RPC checks the student/class/assignment relationship again.
 */
export async function readStudentAssignmentProgressStates(
  studentId: string,
  classId: string,
  assignmentIds: readonly string[],
): Promise<Map<string, StudentAssignmentProgressState>> {
  const requestedIds = [...new Set(assignmentIds)];
  if (requestedIds.length === 0) return new Map();

  const { data, error } = await createAdminClient().rpc("student_assignment_progress_states", {
    p_student_id: studentId,
    p_class_id: classId,
    p_assignment_ids: requestedIds,
  });
  if (error || !Array.isArray(data)) {
    throw new Error("Assignment progress is unavailable.");
  }

  const requested = new Set(requestedIds);
  const states = new Map<string, StudentAssignmentProgressState>();
  for (const value of data as unknown[]) {
    const state = parseRow(value);
    if (!requested.has(state.assignmentId) || states.has(state.assignmentId)) {
      throw new Error("Assignment progress is unavailable.");
    }
    states.set(state.assignmentId, state);
  }
  if (states.size !== requested.size) {
    throw new Error("Assignment progress is unavailable.");
  }
  return states;
}
