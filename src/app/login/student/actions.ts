"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createStudentSupabaseSession } from "@/lib/auth/student-supabase-auth";
import { validateStudentCode, validateStudentID } from "@/lib/auth/validate-student-signup";

export async function loginStudent(studentID: string, classroomCode: string): Promise<
  | { ok: true }
  | { ok: false; field: "studentID" | "code" | "form"; message: string }
> {
  const normalizedStudentID = studentID.trim();
  const normalizedCode = classroomCode.trim().toUpperCase();
  const studentIDError = validateStudentID(normalizedStudentID);
  if (studentIDError) {
    return { ok: false, field: "studentID", message: studentIDError };
  }
  const codeError = validateStudentCode(normalizedCode);
  if (codeError) {
    return { ok: false, field: "code", message: codeError };
  }

  // Student ID and classroom code remain the student-facing credentials. The
  // successful lookup is exchanged for a standard Supabase Auth session.
  const supabase = createAdminClient();

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id")
    .eq("class_code", normalizedCode)
    .eq("is_active", true)
    .maybeSingle();

  if (classError) {
    return { ok: false, field: "form", message: "Could not verify that classroom." };
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
    return { ok: false, field: "form", message: "Could not verify that student account." };
  }

  if (!student) {
    return {
      ok: false,
      field: "studentID",
      message: "That Student ID was not found in this classroom.",
    };
  }

  const sessionError = await createStudentSupabaseSession(supabase, student);
  if (sessionError) {
    return { ok: false, field: "form", message: sessionError };
  }

  return { ok: true };
}
