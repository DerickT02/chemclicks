import "server-only";

import { isAssignmentAvailable } from "@/lib/assignments/availability";
import { getStudentAssignments, type StudentAssignment } from "@/lib/db/student-assignments";

export type BohrQuizAccess =
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "locked" }
  | { status: "available"; assignment: StudentAssignment };

export function findBohrQuizAssignment(
  assignments: StudentAssignment[],
  now: number = Date.now(),
): StudentAssignment | null {
  return assignments.find((assignment) =>
    (assignment.activity.type === "bohr_model_intro"
      || assignment.activity.type === "bohr_model_stability")
    && isAssignmentAvailable(assignment, now),
  ) ?? null;
}

export async function getBohrQuizAccess(): Promise<BohrQuizAccess> {
  const result = await getStudentAssignments();
  if (result.status !== "ok") return result;

  const assignment = findBohrQuizAssignment(result.assignments);
  return assignment ? { status: "available", assignment } : { status: "locked" };
}
