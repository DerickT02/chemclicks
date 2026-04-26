// Logic and types regarding the STUDENTS table.

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export type Student = {
  id: string           // UUID, auto-generated
  class_id: string     // UUID, FK → classes.id
  student_id: string   // Student-supplied ID, unique within a class
  first_name: string
  last_name: string
  verified: boolean    // defaults to false — teacher approves via admin page
  created_at: string   // ISO 8601 timestamp, auto-set
}

export type InsertStudent = Pick<
  Student,
  "class_id" | "student_id" | "first_name" | "last_name"
>;

/**
 * Inserts a pending student row (verified = false). Caller is responsible for
 * validating the classroom code and passing a service-role client — students
 * have no Supabase auth session, so RLS must be bypassed for this write.
 */
export async function insertPendingStudent(
  supabase: SupabaseClient,
  row: InsertStudent,
): Promise<{ data: Student | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("students")
    .insert({ ...row, verified: false })
    .select("id, class_id, student_id, first_name, last_name, verified, created_at")
    .single();

  if (error) {
    return { data: null, error };
  }

  return { data: data as Student, error: null };
}