import "server-only";

import { isAssignmentAvailable } from "@/lib/assignments/availability";
import { getSectionAccess } from "@/lib/assignments/prerequisites";
import { getStudentAssignmentSchedules, type StudentAssignment } from "@/lib/db/student-assignments";

const BOHR_ACTIVITY_TYPES = ["bohr_model_intro", "bohr_model_stability"] as const;

export type BohrQuizAccess =
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "locked" }
  | { status: "selection"; assignments: StudentAssignment[] }
  | { status: "missing" }
  | { status: "scheduled"; assignment: StudentAssignment }
  | { status: "closed"; assignment: StudentAssignment }
  | { status: "blocked"; assignment: StudentAssignment; blocker: StudentAssignment }
  | { status: "available"; assignment: StudentAssignment };

function isBohrAssignment(assignment: StudentAssignment): boolean {
  return BOHR_ACTIVITY_TYPES.includes(assignment.activity.type as typeof BOHR_ACTIVITY_TYPES[number]);
}

export function findBohrQuizAssignment(
  assignments: StudentAssignment[],
  now: number = Date.now(),
): StudentAssignment | null {
  const available = assignments.filter((assignment) =>
    (assignment.activity.type === "bohr_model_intro"
      || assignment.activity.type === "bohr_model_stability")
    && isAssignmentAvailable(assignment, now),
  );
  return available.length === 1 ? available[0] : null;
}

/**
 * Resolves a Bohr quiz from an explicit originating assignment when provided.
 * Generic entry is only automatic when there is exactly one Bohr assignment;
 * multiple assignments require the caller to present a choice. Either way the
 * lesson's earlier sections must be finished first.
 */
export async function getBohrQuizAccess(assignmentId?: string): Promise<BohrQuizAccess> {
  const result = await getStudentAssignmentSchedules();
  if (result.status !== "ok") return result;

  const bohrAssignments = result.assignments.filter(isBohrAssignment);
  if (assignmentId !== undefined) {
    const assignment = bohrAssignments.find((item) => item.id === assignmentId);
    if (!assignment) return { status: "missing" };
    return getSectionAccess(assignment);
  }

  // Generic entry offers open lessons first, then any scheduled or closed one.
  const now = Date.now();
  const open = bohrAssignments.filter((assignment) => isAssignmentAvailable(assignment, now));
  const candidates = open.length > 0 ? open : bohrAssignments;
  if (candidates.length === 0) return { status: "locked" };
  if (candidates.length > 1) return { status: "selection", assignments: candidates };
  return getSectionAccess(candidates[0]);
}
