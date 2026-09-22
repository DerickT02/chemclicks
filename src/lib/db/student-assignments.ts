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

/** Never accept student/class IDs from callers or cache across requests. */
export async function getStudentAssignments(): Promise<Result> {
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
    const assignments: StudentAssignment[] = [];
    const pageSize = 100;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("class_activities")
        .select("id, opens_at, closes_at, activity:activities!inner(id, title, type, order_index)")
        .eq("class_id", classroom.id)
        .or(`opens_at.is.null,opens_at.lte.${now}`)
        .or(`closes_at.is.null,closes_at.gt.${now}`)
        .order("id")
        .range(offset, offset + pageSize - 1)
        .returns<StudentAssignment[]>();
      if (error) throw error;
      assignments.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }

    // Recheck after querying, in case a deadline passed during the request.
    const checkedAt = Date.now();
    return {
      status: "ok",
      assignments: assignments
        .filter((assignment) => isAssignmentAvailable(assignment, checkedAt))
        .sort((a, b) => a.activity.order_index - b.activity.order_index || a.id.localeCompare(b.id)),
    };
  } catch {
    return { status: "error", message: "Your assignments could not be loaded. Please try again." };
  }
}
