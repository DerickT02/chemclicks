"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  CLASS_CODE_LOOKUP_MESSAGE,
  CLASS_CODE_NOT_FOUND_MESSAGE,
  DATABASE_RETRY_MESSAGE,
  INVALID_STUDENT_ID_MESSAGE,
  SESSION_RETRY_MESSAGE,
} from "@/lib/errors/user-facing-errors";
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
    return { ok: false, field: "code", message: CLASS_CODE_LOOKUP_MESSAGE };
  }

  if (!classRow) {
    return {
      ok: false,
      field: "code",
      message: CLASS_CODE_NOT_FOUND_MESSAGE,
    };
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, auth_user_id")
    .eq("class_id", classRow.id)
    .eq("student_id", normalizedStudentID)
    .maybeSingle();

  if (studentError) {
    return { ok: false, field: "form", message: DATABASE_RETRY_MESSAGE };
  }

  if (!student) {
    return {
      ok: false,
      field: "studentID",
      message: INVALID_STUDENT_ID_MESSAGE,
    };
  }

  try {
    await createStudentSupabaseSession(supabase, student);
  } catch {
    return {
      ok: false,
      field: "form",
      message: SESSION_RETRY_MESSAGE,
    };
  }

  return { ok: true };
}
