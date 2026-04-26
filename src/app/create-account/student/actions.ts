'use server';

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { insertPendingStudent } from "@/lib/db/students";

type CreateStudentAccountInput = {
  firstName: string;
  lastName: string;
  studentID: string;
  code: string;
};

type CreateStudentAccountResult =
  | { ok: true }
  | { ok: false; message: string };

const CLASS_CODE_PATTERN = /^[A-Za-z0-9]{6}$/;

/**
 * Creates a pending student account. Runs server-side with the service role
 * because students have no Supabase auth session. Validates input, looks up
 * the class by class_code, and inserts with verified = false.
 */
export async function createStudentAccount(
  input: CreateStudentAccountInput,
): Promise<CreateStudentAccountResult> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const studentID = input.studentID.trim();
  const code = input.code.trim().toUpperCase();

  if (!firstName) return { ok: false, message: "First name is required." };
  if (!lastName) return { ok: false, message: "Last name is required." };
  if (!studentID) return { ok: false, message: "Student ID is required." };
  if (!CLASS_CODE_PATTERN.test(code)) {
    return { ok: false, message: "Classroom code must be 6 letters or digits." };
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1. Look up the class by its join code.
  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id")
    .eq("class_code", code)
    .maybeSingle();

  if (classError) return { ok: false, message: "Could not verify classroom code." };
  if (!classRow) return { ok: false, message: "Classroom code not found." };

  // 2. Insert the pending student.
  const { error: insertError } = await insertPendingStudent(supabase, {
    class_id: classRow.id,
    student_id: studentID,
    first_name: firstName,
    last_name: lastName,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        ok: false,
        message: "A student with that ID is already registered in this class.",
      };
    }
    return { ok: false, message: "Could not create account. Please try again." };
  }

  return { ok: true };}