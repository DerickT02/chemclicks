"use server";

import { createServiceClient } from "@/lib/server/database";
import { validateStudentSignup } from "@/lib/auth/validate-student-signup";

type SignupResult = { ok: true } | { ok: false; message: string; field?: "studentID" | "code" };

export async function signupStudent(input: unknown): Promise<SignupResult> {
  if (!input || typeof input !== "object") return { ok: false, message: "Invalid signup details." };
  const { firstName, lastName, studentID, code } = input as Record<string, unknown>;
  if (typeof firstName !== "string" || typeof lastName !== "string" ||
      typeof studentID !== "string" || typeof code !== "string") {
    return { ok: false, message: "Invalid signup details." };
  }
  const validation = validateStudentSignup(firstName, lastName, studentID, code);
  if (!validation.valid) {
    return { ok: false, message: validation.firstNameError ?? validation.lastNameError ??
      validation.studentIDError ?? validation.codeError ?? "Invalid signup details." };
  }
  try {
    const client = createServiceClient();
    const { data: classroom, error } = await client.from("classes")
      .select("id, is_active").eq("class_code", code.trim().toUpperCase()).maybeSingle();
    if (error) return { ok: false, message: "Unable to create your account. Please try again." };
    if (!classroom || !classroom.is_active) {
      return { ok: false, field: "code", message: "That classroom code was not found or is inactive." };
    }
    // Only these fields may be supplied. Signup never approves a student or creates a session.
    const { error: insertError } = await client.from("students").insert({
      class_id: classroom.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      student_id: studentID.trim(),
      verified: false,
    });
    if (insertError) return { ok: false, field: insertError.code === "23505" ? "studentID" : undefined, message: insertError.code === "23505"
      ? "That Student ID is already registered. Please sign in or contact your teacher."
      : "Unable to create your account. Please try again." };
    return { ok: true };
  } catch {
    return { ok: false, message: "Unable to create your account. Please try again." };
  }
}
