import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { StudentProgress } from "@/lib/db/student_progress";

export type TeacherRosterStudent = {
  id: string;
  class_id: string;
  first_name: string;
  last_name: string;
};

type ReadResult<T> = { data: T[] | null; error: PostgrestError | null };

export type TeacherProgressRow = Pick<StudentProgress, "student_id" | "class_activity_id" | "status">;

/** Call only with active class IDs obtained from the authenticated teacher's owned-class list. */
export async function getTeacherRoster(
  supabase: SupabaseClient,
  ownedClassIds: readonly string[],
): Promise<ReadResult<TeacherRosterStudent>> {
  if (ownedClassIds.length === 0) return { data: [], error: null };
  return supabase.from("students")
    .select("id, class_id, first_name, last_name").in("class_id", [...new Set(ownedClassIds)])
    .order("last_name").order("first_name").order("id")
    .returns<TeacherRosterStudent[]>();
}

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
