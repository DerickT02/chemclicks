import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const STUDENT_AUTH_DOMAIN = "students.auth.chemclicks.invalid";
const SESSION_ERROR_MESSAGE = "Could not create a student session. Please try again.";

type StudentAuthRecord = {
  id: string;
};

/** Create a unique, non-deliverable email used only as a Supabase Auth identity. */
export function createStudentAuthEmail(): string {
  return `student-${randomUUID()}@${STUDENT_AUTH_DOMAIN}`;
}

/**
 * Converts validated Student ID/class-code credentials into a normal Supabase
 * Auth session. The student row UUID is also the auth.users UUID, so the admin
 * lookup can recover the hidden identity without an extra mapping column.
 */
export async function createStudentSupabaseSession(
  admin: SupabaseClient,
  student: StudentAuthRecord,
): Promise<string | null> {
  try {
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(student.id);
    const email = userData.user?.email;
    if (userError || !email) return SESSION_ERROR_MESSAGE;

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (
      linkError
      || linkData.user?.id !== student.id
      || !linkData.properties?.hashed_token
    ) {
      return SESSION_ERROR_MESSAGE;
    }

    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });

    return verifyError ? SESSION_ERROR_MESSAGE : null;
  } catch {
    return SESSION_ERROR_MESSAGE;
  }
}
