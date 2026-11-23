import "server-only";

import { isAssignmentAvailable } from "@/lib/assignments/availability";
import { LEWIS_QUIZZES, type LewisQuizKind } from "@/lib/assignments/lewis-quizzes";
import { getSectionAccess } from "@/lib/assignments/prerequisites";
import { getStudentAssignmentSchedules, type StudentAssignment } from "@/lib/db/student-assignments";

export type LewisQuizAccess =
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "locked" }
  | { status: "selection"; assignments: StudentAssignment[] }
  | { status: "missing" }
  | { status: "scheduled"; assignment: StudentAssignment }
  | { status: "closed"; assignment: StudentAssignment }
  | { status: "available"; assignment: StudentAssignment };

/**
 * Only an open assignment of that quiz's lesson grants access; other Lewis
 * activities, including the other quiz's lesson, never unlock it.
 */
export function findLewisQuizAssignment(
  assignments: StudentAssignment[],
  kind: LewisQuizKind,
  now: number = Date.now(),
): StudentAssignment | null {
  const { lessonType } = LEWIS_QUIZZES[kind];
  return assignments.find((assignment) =>
    assignment.activity.type === lessonType
    && isAssignmentAvailable(assignment, now),
  ) ?? null;
}

/**
 * Resolves access from the signed-in student's own class assignments. An
 * explicit assignment must be this quiz's lesson; earlier sections must be done.
 */
export async function getLewisQuizAccess(
  kind: LewisQuizKind,
  assignmentId?: string,
): Promise<LewisQuizAccess> {
  const result = await getStudentAssignmentSchedules();
  if (result.status !== "ok") return result;

  const lessons = result.assignments.filter((item) =>
    item.activity.type === LEWIS_QUIZZES[kind].lessonType,
  );
  if (assignmentId !== undefined) {
    const assignment = lessons.find((item) => item.id === assignmentId);
    return assignment ? getSectionAccess(assignment) : { status: "missing" };
  }

  // Generic entry offers open lessons first, then any scheduled or closed one.
  // Multiple matches require the caller to present a choice, matching Bohr quizzes.
  const now = Date.now();
  const open = lessons.filter((item) => isAssignmentAvailable(item, now));
  const candidates = open.length > 0 ? open : lessons;
  if (candidates.length === 0) return { status: "locked" };
  if (candidates.length > 1) return { status: "selection", assignments: candidates };
  return getSectionAccess(candidates[0]);
}
