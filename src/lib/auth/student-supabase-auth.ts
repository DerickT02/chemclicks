import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const SESSION_ERROR = "Could not create a student session. Please try again.";

type Student = { id: string; auth_user_id: string | null };

// Supabase Auth needs an email identity; students never see or receive mail at
// this reserved address. Their credentials remain Student ID + classroom code.
function studentAuthEmail(studentId: string): string {
  return `student-${studentId}@students.auth.chemclicks.invalid`;
}

export async function createStudentSupabaseSession(
  admin: SupabaseClient,
  student: Student,
): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: studentAuthEmail(student.id),
    });
    const authUserId = data.user?.id;
    const verificationType = data.properties?.verification_type;
    if (
      error || !authUserId || !data.properties?.hashed_token
      || (verificationType !== "signup" && verificationType !== "magiclink")
    ) return SESSION_ERROR;
    if (student.auth_user_id && student.auth_user_id !== authUserId) return SESSION_ERROR;

    if (!student.auth_user_id) {
      const linked = await admin.from("students")
        .update({ auth_user_id: authUserId })
        .eq("id", student.id)
        .is("auth_user_id", null)
        .select("auth_user_id")
        .maybeSingle();
      if (linked.error) return SESSION_ERROR;
      if (linked.data?.auth_user_id !== authUserId) {
        // Another login may have linked the same Auth user concurrently.
        const current = await admin.from("students")
          .select("auth_user_id").eq("id", student.id).maybeSingle();
        if (current.error || current.data?.auth_user_id !== authUserId) return SESSION_ERROR;
      }
    }

    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: data.properties.hashed_token,
      type: verificationType,
    });
    return verifyError ? SESSION_ERROR : null;
  } catch {
    return SESSION_ERROR;
  }
}
