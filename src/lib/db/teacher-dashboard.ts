import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { StudentProgress } from "@/lib/db/student_progress";

type ReadResult<T> = { data: T[] | null; error: PostgrestError | null };

export type TeacherProgressRow = Pick<StudentProgress, "student_id" | "class_activity_id" | "status">;

/** Selected class only; constrain both sides of the progress relationship to that class. */
export async function getClassCurrentProgress(
  supabase: SupabaseClient,
  ownedClassId: string,
): Promise<ReadResult<TeacherProgressRow>> {
  return supabase.from("student_progress")
    .select("student_id, class_activity_id, status, assignment:class_activities!inner(class_id), student:students!inner(class_id)")
    .eq("assignment.class_id", ownedClassId).eq("student.class_id", ownedClassId)
    .order("id")
    .returns<TeacherProgressRow[]>();
}
