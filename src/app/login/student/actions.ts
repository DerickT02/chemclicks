"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createStudentSession } from "@/lib/auth/student-session";
import {
  CLASS_CODE_LOOKUP_MESSAGE,
  CLASS_CODE_NOT_FOUND_MESSAGE,
  DATABASE_RETRY_MESSAGE,
  INVALID_STUDENT_ID_MESSAGE,
  SESSION_RETRY_MESSAGE,
} from "@/lib/errors/user-facing-errors";

export async function loginStudent(studentID: string, classroomCode: string): Promise<
  | { ok: true }
  | { ok: false; field: "studentID" | "code" | "form"; message: string }
> {
  const normalizedStudentID = studentID.trim();
  const normalizedCode = classroomCode.trim().toUpperCase();
  // Student ID and classroom code are the student login credentials.
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
    .select("id")
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
    await createStudentSession(student.id, classRow.id);
  } catch {
    return {
      ok: false,
      field: "form",
      message: SESSION_RETRY_MESSAGE,
    };
  }

  return { ok: true };
}
