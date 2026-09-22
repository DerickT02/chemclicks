"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createStudentAuthEmail } from "@/lib/auth/student-supabase-auth";
import { validateStudentSignup } from "@/lib/auth/validate-student-signup";

type StudentSignupFailure = {
  ok: false;
  field: "firstName" | "lastName" | "studentID" | "code" | "form";
  message: string;
};

export type StudentSignupResult = { ok: true } | StudentSignupFailure;

export async function createStudentAccount(
  firstName: string,
  lastName: string,
  studentID: string,
  classroomCode: string,
): Promise<StudentSignupResult> {
  const normalizedFirstName = firstName.trim();
  const normalizedLastName = lastName.trim();
  const normalizedStudentID = studentID.trim();
  const normalizedCode = classroomCode.trim().toUpperCase();
  const validation = validateStudentSignup(
    normalizedFirstName,
    normalizedLastName,
    normalizedStudentID,
    normalizedCode,
  );

  if (!validation.valid) {
    if (validation.firstNameError) {
      return { ok: false, field: "firstName", message: validation.firstNameError };
    }
    if (validation.lastNameError) {
      return { ok: false, field: "lastName", message: validation.lastNameError };
    }
    if (validation.studentIDError) {
      return { ok: false, field: "studentID", message: validation.studentIDError };
    }
    return {
      ok: false,
      field: "code",
      message: validation.codeError ?? "Please enter a code.",
    };
  }

  const admin = createAdminClient();
  const { data: classroom, error: classError } = await admin
    .from("classes")
    .select("id, is_active")
    .eq("class_code", normalizedCode)
    .maybeSingle();

  if (classError) {
    return { ok: false, field: "form", message: "Could not verify that classroom." };
  }
  if (!classroom) {
    return { ok: false, field: "code", message: "That classroom code was not found." };
  }
  if (!classroom.is_active) {
    return { ok: false, field: "code", message: "That classroom is inactive." };
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: createStudentAuthEmail(),
    email_confirm: true,
    app_metadata: { account_type: "student" },
  });

  if (authError || !authData.user) {
    return { ok: false, field: "form", message: "Could not create the student account." };
  }

  // One UUID represents the student in both auth.users and public.students.
  const { error: studentError } = await admin.from("students").insert({
    id: authData.user.id,
    class_id: classroom.id,
    first_name: normalizedFirstName,
    last_name: normalizedLastName,
    student_id: normalizedStudentID,
  });

  if (studentError) {
    // Compensate for the cross-schema operation so a failed insert does not
    // leave an orphaned hidden Auth identity.
    await admin.auth.admin.deleteUser(authData.user.id);

    if (studentError.code === "23505") {
      return { ok: false, field: "studentID", message: "That Student ID is already registered." };
    }
    return { ok: false, field: "form", message: "Could not create the student account." };
  }

  return { ok: true };
}
