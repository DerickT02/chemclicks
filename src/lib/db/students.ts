// Defines the STUDENTS table and attributes
// Enforces data types and constraints at compile time

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export type Student = {
  id: string          // UUID, auto-generated
  class_id: string    // UUID, FK → classes.id
  first_name: string
  last_name: string
  created_at: string  // ISO 8601 timestamp, auto-set
  student_id: string  // text, unique username / PIN, NOT NULL
  verified: boolean   // defaults to false
}

export type InsertStudent = Pick<Student, 'class_id' | 'first_name' | 'last_name' | 'student_id'>

export async function insertStudent(
  supabase: SupabaseClient,
  row: InsertStudent,
): Promise<{ data: Student | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("students")
    .insert(row)
    .select("id, class_id, first_name, last_name, created_at, student_id, verified")
    .single();

  if (error) {
    return { data: null, error };
  }

  return { data: data as Student, error: null };
}
