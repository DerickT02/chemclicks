import type { SupabaseClient } from "@supabase/supabase-js";
import { readAllPages, type ReadResult } from "@/lib/db/read-pages";
import type { StudentProgress } from "@/lib/db/student_progress";

export type TeacherRosterStudent = {
  id: string;
  class_id: string;
  first_name: string;
  last_name: string;
};

export type TeacherProgressRow = Pick<StudentProgress, "student_id" | "class_activity_id" | "status">;

/** Call only with active class IDs obtained from the authenticated teacher's owned-class list. */
export async function getTeacherRoster(
  supabase: SupabaseClient,
  ownedClassIds: readonly string[],
): Promise<ReadResult<TeacherRosterStudent>> {
  const classIds = [...new Set(ownedClassIds)];
  const students = new Map<string, TeacherRosterStudent>();
  // Bound IN-filter sizes instead of placing arbitrarily many UUIDs in a URL.
  for (let index = 0; index < classIds.length; index += 50) {
    const batch = classIds.slice(index, index + 50);
    const result = await readAllPages((from, to) => supabase.from("students")
      .select("id, class_id, first_name, last_name").in("class_id", batch)
      .order("id").range(from, to).returns<TeacherRosterStudent[]>());
    if (result.error || result.data === null) return result;
    for (const student of result.data) {
      if (batch.includes(student.class_id)) students.set(student.id, student);
    }
  }
  return { data: [...students.values()].sort((a, b) =>
    a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name) || a.id.localeCompare(b.id)), error: null };
}

/** Selected class only; constrain both sides of the progress relationship to that class. */
export async function getClassCurrentProgress(
  supabase: SupabaseClient,
  ownedClassId: string,
): Promise<ReadResult<TeacherProgressRow>> {
  return readAllPages((from, to) => supabase.from("student_progress")
    .select("student_id, class_activity_id, status, assignment:class_activities!inner(class_id), student:students!inner(class_id)")
    .eq("assignment.class_id", ownedClassId).eq("student.class_id", ownedClassId)
    .order("id").range(from, to).returns<TeacherProgressRow[]>());
}
