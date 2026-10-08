import "server-only";

import { isAssignmentAvailable } from "@/lib/assignments/availability";
import { LEWIS_QUIZZES, type LewisQuizKind } from "@/lib/assignments/lewis-quizzes";
import { getStudentAssignmentSchedules, type StudentAssignment } from "@/lib/db/student-assignments";

export type LewisQuizAccess =
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "locked" }
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

/** Resolves access from the signed-in student's own class assignments. */
export async function getLewisQuizAccess(kind: LewisQuizKind): Promise<LewisQuizAccess> {
  const result = await getStudentAssignmentSchedules();
  if (result.status !== "ok") return result;

  const now = Date.now();
  const available = findLewisQuizAssignment(result.assignments, kind, now);
  if (available) return { status: "available", assignment: available };

  const assignment = result.assignments.find((item) =>
    item.activity.type === LEWIS_QUIZZES[kind].lessonType,
  );
  if (!assignment) return { status: "locked" };
  if (assignment.opens_at && Date.parse(assignment.opens_at) > now
    && (assignment.closes_at === null || Date.parse(assignment.closes_at) > now)) {
    return { status: "scheduled", assignment };
  }
  return { status: "closed", assignment };
}
