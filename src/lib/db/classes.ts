// Logic and types regarding the CLASSES table.

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export type Class = {
  id: string          // UUID, auto-generated
  teacher_id: string  // UUID, FK → teachers.id
  name: string
  section: string
  class_code: string  // 6-char uppercase alphanumeric, unique
  is_active: boolean  // defaults to true
  created_at: string  // ISO 8601 timestamp, auto-set
}

export type InsertClass = Pick<Class, "teacher_id" | "name" | "section" | "class_code">;

export type ClassListItem = Pick<Class, "id" | "name" | "section" | "class_code">;

/**
 * Lists active classes owned by the given teacher, newest first. Filters by
 * `teacher_id` explicitly (defense in depth alongside RLS) and `is_active`,
 * so a teacher's classroom list never includes another teacher's classes or
 * a class they've deactivated.
 */
export async function listActiveClassesForTeacher(
  supabase: SupabaseClient,
  teacherId: string,
): Promise<{ data: ClassListItem[] | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, section, class_code")
    .eq("teacher_id", teacherId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error };
  }

  return { data: data as ClassListItem[], error: null };
}

/**
 * True when a PostgrestError is the `classes.class_code` unique-constraint
 * violation (Postgres code 23505), as opposed to some other constraint
 * (e.g. the teacher/name/section uniqueness) or an unrelated failure.
 */
export function isDuplicateClassCodeError(error: PostgrestError): boolean {
  return error.code === "23505" && error.message.includes("class_code");
}

/**
 * Looks up a class by its normalized code, scoped by RLS to the current
 * teacher. Used as a fast, friendly pre-check before insert; the DB's unique
 * constraint on `class_code` (global, not per-teacher) remains the source of
 * truth for correctness under concurrent submissions.
 */
export async function findClassByCode(
  supabase: SupabaseClient,
  class_code: string,
): Promise<{ exists: boolean; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("class_code", class_code)
    .maybeSingle();

  if (error) {
    return { exists: false, error };
  }

  return { exists: data !== null, error: null };
}

/**
 * Deletes a row from `classes` by id. RLS enforces that only the owning teacher
 * can delete (teacher_id = auth.uid()), so use the request-scoped server client.
 */
export async function deleteClass(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from("classes").delete().eq("id", id);
  return { error };
}

/**
 * Inserts a row into `classes`. Use the request-scoped client from
 * `@/lib/supabase/server` so RLS applies (`teacher_id` must match `auth.uid()`).
 */
export async function insertClass(
  supabase: SupabaseClient,
  row: InsertClass,
): Promise<{ data: Class | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("classes")
    .insert(row)
    .select(
      "id, teacher_id, name, section, class_code, is_active, created_at",
    )
    .single();

  if (error) {
    return { data: null, error };
  }

  return { data: data as Class, error: null };
}
