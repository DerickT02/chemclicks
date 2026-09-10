"use server";

import { createClient } from "@/lib/supabase/server";
import { createStudentSession } from "@/lib/auth/student-session";

export async function loginStudent(studentID: string, classroomCode: string): Promise<
  | { ok: true }
  | { ok: false; field: "studentID" | "code" | "form"; message: string }
> {
  const normalizedStudentID = studentID.trim();
  const normalizedCode = classroomCode.trim().toUpperCase();
  const supabase = await createClient();

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id")
    .eq("class_code", normalizedCode)
    .eq("is_active", true)
    .maybeSingle();

  if (classError) {
    return { ok: false, field: "form", message: classError.message };
  }

  if (!classRow) {
    return {
      ok: false,
      field: "code",
      message: "That classroom code was not found or is inactive.",
    };
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", classRow.id)
    .eq("student_id", normalizedStudentID)
    .maybeSingle();

  if (studentError) {
    return { ok: false, field: "form", message: studentError.message };
  }

  if (!student) {
    return {
      ok: false,
      field: "studentID",
      message: "That Student ID was not found in this classroom.",
    };
  }

  try {
    await createStudentSession(student.id, classRow.id);
  } catch (error) {
    return {
      ok: false,
      field: "form",
      message: error instanceof Error ? error.message : "Could not create a student session.",
    };
  }

  return { ok: true };
}
