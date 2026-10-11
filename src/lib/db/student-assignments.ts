import "server-only";

import { getStudentSession } from "@/lib/auth/student-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAssignmentAvailable } from "@/lib/assignments/availability";
import type { Activity } from "@/lib/db/activities";

export type StudentAssignment = {
  id: string;
  opens_at: string | null;
  closes_at: string | null;
  activity: Activity;
};

type Result =
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "ok"; assignments: StudentAssignment[] };

/** Only currently open work; never accept student/class IDs from callers. */
export async function getStudentAssignments(): Promise<Result> {
  return readStudentAssignments(true);
}

/** Own-class schedule metadata only, including upcoming/closed work; no exercise content. */
export async function getStudentAssignmentSchedules(): Promise<Result> {
  return readStudentAssignments(false);
}

/** Never cache across requests; both read paths enforce student/class ownership. */
async function readStudentAssignments(onlyAvailable: boolean): Promise<Result> {
  try {
    const session = await getStudentSession();
    if (!session) return { status: "unauthenticated" };

    const supabase = createAdminClient();
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, class_id")
      .eq("id", session.studentId)
      .eq("class_id", session.classId)
      .maybeSingle();
    if (studentError) throw studentError;
    if (!student) return { status: "unauthenticated" };

    const { data: classroom, error: classError } = await supabase
      .from("classes").select("id")
      .eq("id", student.class_id).eq("is_active", true).maybeSingle();
    if (classError) throw classError;
    if (!classroom) return { status: "unauthenticated" };

    const now = new Date().toISOString();
    let query = supabase
      .from("class_activities")
      .select("id, opens_at, closes_at, activity:activities!inner(id, title, type, order_index)")
      .eq("class_id", classroom.id);
    if (onlyAvailable) {
      query = query
        .or(`opens_at.is.null,opens_at.lte.${now}`)
        .or(`closes_at.is.null,closes_at.gt.${now}`);
    }
    const { data, error } = await query.order("id").returns<StudentAssignment[]>();
    if (error) throw error;
    const assignments = data ?? [];

    // Recheck after querying, in case a deadline passed during the request.
    const checkedAt = Date.now();
    return {
      status: "ok",
      assignments: assignments
        .filter((assignment) => !onlyAvailable || isAssignmentAvailable(assignment, checkedAt))
        .sort((a, b) => a.activity.order_index - b.activity.order_index || a.id.localeCompare(b.id)),
    };
  } catch {
    return { status: "error", message: "Your assignments could not be loaded. Please try again." };
  }
}
