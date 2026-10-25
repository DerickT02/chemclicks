import "server-only";

import { isAssignmentAvailable } from "@/lib/assignments/availability";
import { LEWIS_QUIZZES, type LewisQuizKind } from "@/lib/assignments/lewis-quizzes";
import { getSectionAccess } from "@/lib/assignments/prerequisites";
import { getStudentAssignmentSchedules, type StudentAssignment } from "@/lib/db/student-assignments";

export type LewisQuizAccess =
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "locked" }
  | { status: "missing" }
  | { status: "scheduled"; assignment: StudentAssignment }
  | { status: "closed"; assignment: StudentAssignment }
  | { status: "blocked"; assignment: StudentAssignment; blocker: StudentAssignment }
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
  const now = Date.now();
  const assignment = lessons.find((item) => isAssignmentAvailable(item, now)) ?? lessons[0];
  if (!assignment) return { status: "locked" };
  return getSectionAccess(assignment);
}
