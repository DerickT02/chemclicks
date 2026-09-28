import "server-only";

import { isAssignmentAvailable } from "@/lib/assignments/availability";
import { LEWIS_QUIZZES, type LewisQuizKind } from "@/lib/assignments/lewis-quizzes";
import { getStudentAssignments, type StudentAssignment } from "@/lib/db/student-assignments";

export type LewisQuizAccess =
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "locked" }
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
  const result = await getStudentAssignments();
  if (result.status !== "ok") return result;

  const assignment = findLewisQuizAssignment(result.assignments, kind);
  return assignment ? { status: "available", assignment } : { status: "locked" };
}
