import { buildTeacherEmailRedirectTo } from "@/lib/auth/teacher-email-verification";
import { EMAIL_RATE_LIMIT_MESSAGE, GENERIC_RETRY_MESSAGE } from "@/lib/errors/user-facing-errors";
import { createClient } from "@/lib/supabase/client";

export type ResendTeacherVerificationResult = { sent: true } | { sent: false; error: string };

export async function resendTeacherVerification(
  email: string,
  origin: string,
): Promise<ResendTeacherVerificationResult> {
  try {
    const { error } = await createClient().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: buildTeacherEmailRedirectTo(origin) },
    });
    if (!error) return { sent: true };
    return {
      sent: false,
      error: error.status === 429 ? EMAIL_RATE_LIMIT_MESSAGE : GENERIC_RETRY_MESSAGE,
    };
  } catch {
    return { sent: false, error: GENERIC_RETRY_MESSAGE };
  }
}
