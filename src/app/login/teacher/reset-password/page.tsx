"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import {
  AuthCard,
  AuthField,
  AuthFormError,
  AuthFooter,
  AuthPageLayout,
  AuthPrimaryButton,
  authSecondaryLinkClassName,
} from "@/components/auth/AuthPageLayout";
import { validateTeacherPassword } from "@/lib/auth/validate-teacher-signup";
import { GENERIC_RETRY_MESSAGE } from "@/lib/errors/user-facing-errors";
import { createClient } from "@/lib/supabase/client";

const EXPIRED_LINK_MESSAGE =
  "Your reset link is invalid or has expired. Please request a new one from the sign-in page.";

const SIGN_OUT_FAILED_MESSAGE =
  "Your password was updated, but you could not be signed out of this reset session. Close this tab, then sign in with your new password.";

/**
 * Signs out of the recovery session. Falls back to clearing only this
 * browser's session when the global sign-out reports an error or throws.
 */
async function endRecoverySession(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  try {
    const { error } = await supabase.auth.signOut();
    if (!error) return true;
  } catch {
    // Fall through to the local sign-out.
  }

  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    return !error;
  } catch {
    return false;
  }
}

export default function TeacherResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(undefined);
    setConfirmError(undefined);
    setFormError(undefined);

    const nextPasswordError = validateTeacherPassword(password);
    let nextConfirmError: string | undefined;
    if (confirmPassword.length === 0) {
      nextConfirmError = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      nextConfirmError = "Passwords do not match.";
    }

    if (nextPasswordError || nextConfirmError) {
      setPasswordError(nextPasswordError);
      setConfirmError(nextConfirmError);
      setPassword("");
      setConfirmPassword("");
      return;
    }

    setIsSubmitting(true);

    const supabase = createClient();
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setFormError(
          isAuthSessionMissingError(error)
            ? EXPIRED_LINK_MESSAGE
            : error.message || GENERIC_RETRY_MESSAGE,
        );
        setPassword("");
        setConfirmPassword("");
        setIsSubmitting(false);
        return;
      }
    } catch {
      setFormError(GENERIC_RETRY_MESSAGE);
      setPassword("");
      setConfirmPassword("");
      setIsSubmitting(false);
      return;
    }

    // The password has changed from here on, so the form must not offer a
    // retry: submitting the same password again would be rejected.
    setPassword("");
    setConfirmPassword("");
    setPasswordUpdated(true);

    // End the recovery session so the teacher signs in through the normal
    // login flow, which checks for an approved teacher record.
    if (await endRecoverySession(supabase)) {
      router.push("/login/teacher?password=reset");
      return;
    }

    setFormError(SIGN_OUT_FAILED_MESSAGE);
    setIsSubmitting(false);
  }

  return (
    <AuthPageLayout>
      <AuthCard
        title="Reset password"
        footer={
          <AuthFooter className="flex flex-col gap-2">
            <Link href="/login/teacher" className={authSecondaryLinkClassName}>
              Back to sign in
            </Link>
          </AuthFooter>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <AuthField
            id="reset-password"
            label="New password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            hint="At least 8 characters with a letter, number, and special character (no spaces, and no &quot; ' \ / ` ; $)."
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError(undefined);
            }}
            error={passwordError}
          />
          <AuthField
            id="reset-password-confirm"
            label="Confirm new password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (confirmError) setConfirmError(undefined);
            }}
            error={confirmError}
          />
          <AuthFormError message={formError} />
          <AuthPrimaryButton type="submit" disabled={isSubmitting || passwordUpdated}>
            {passwordUpdated ? "Password updated" : isSubmitting ? "Updating password..." : "Update password"}
          </AuthPrimaryButton>
        </form>
      </AuthCard>
    </AuthPageLayout>
  );
}
