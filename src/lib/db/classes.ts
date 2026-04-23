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

/**
 * Inserts a row into `classes`. Call with the request-scoped client from
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
