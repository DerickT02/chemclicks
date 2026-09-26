"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  AuthCard,
  AuthField,
  AuthFormError,
  AuthFooter,
  AuthPageLayout,
  AuthPrimaryButton,
} from "@/components/auth/AuthPageLayout";
import {
  buildTeacherEmailRedirectTo,
  getTeacherVerificationMessage,
} from "@/lib/auth/teacher-email-verification";
import { validateTeacherSignup } from "@/lib/auth/validate-teacher-signup";
import { insertTeacher } from "@/lib/db/teachers";
import { DATABASE_RETRY_MESSAGE, isDuplicateAuthError } from "@/lib/errors/user-facing-errors";
import { createClient } from "@/lib/supabase/client";

export default function TeacherCreateAccountPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayNameError, setDisplayNameError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (confirmationSent) {
    return (
      <AuthPageLayout>
        <AuthCard
          title="Check your email"
          footer={
            <AuthFooter className="text-muted-foreground">
              Already verified?{" "}
              <Link
                href="/login/teacher"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </AuthFooter>
          }
        >
          <p className="text-sm text-muted-foreground" role="status">
            {getTeacherVerificationMessage(email)}
          </p>
        </AuthCard>
      </AuthPageLayout>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setDisplayNameError(undefined);
    setEmailError(undefined);
    setPasswordError(undefined);
    setConfirmError(undefined);
    setFormError(undefined);

    const result = validateTeacherSignup(displayName, email, password, confirmPassword);
    if (!result.valid) {
      setDisplayNameError(result.displayNameError);
      setEmailError(result.emailError);
      setPasswordError(result.passwordError);
      setConfirmError(result.confirmError);
      setPassword("");
      setConfirmPassword("");
      return;
    }

    setIsSubmitting(true);

    const supabase = createClient();
    const normalizedDisplayName = displayName.trim();
    const normalizedEmail = email.trim();
    const emailRedirectTo = buildTeacherEmailRedirectTo(window.location.origin);

    const { data: authData, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo,
        data: {
          display_name: normalizedDisplayName,
        },
      },
    });

    // With email confirmation enabled, Supabase can return an obfuscated user
    // with no identities instead of an AuthError for an existing email.
    // See: https://stackoverflow.com/questions/73802604/how-to-check-if-user-already-exists-in-supabase
    if (
      authData.user?.identities?.length === 0 ||
      isDuplicateAuthError(error)
    ) {
      setEmailError(
        "This email is already registered. Please use a different email or sign in.",
      );
      setPassword("");
      setConfirmPassword("");
      setIsSubmitting(false);
      return;
    }

    if (error) {
      setFormError(DATABASE_RETRY_MESSAGE);
      setPassword("");
      setConfirmPassword("");
      setIsSubmitting(false);
      return;
    }

    if (!authData.user) {
      setFormError("Could not create account. Please try again.");
      setIsSubmitting(false);
      return;
    }

    const { error: teacherError } = await insertTeacher(supabase, {
      id: authData.user.id,
      email: normalizedEmail,
      display_name: normalizedDisplayName,
    });

    if (teacherError) {
      setFormError(teacherError.message || "Could not create teacher profile.");
      setIsSubmitting(false);
      return;
    }

    setDisplayName("");
    setEmail(normalizedEmail);
    setPassword("");
    setConfirmPassword("");
    setConfirmationSent(true);
    setIsSubmitting(false);
  }

  return (
    <AuthPageLayout>
      <AuthCard
        title="Create account"
        footer={
          <AuthFooter className="text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login/teacher"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </AuthFooter>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <AuthField
            id="signup-display-name"
            label="Display name"
            type="text"
            placeholder="e.g. Ms. Smith"
            autoComplete="name"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (displayNameError) setDisplayNameError(undefined);
            }}
            error={displayNameError}
          />
          <AuthField
            id="signup-email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(undefined);
            }}
            error={emailError}
          />
          <AuthField
            id="signup-password"
            label="Password"
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
            id="signup-password-confirm"
            label="Confirm password"
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
          <AuthPrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </AuthPrimaryButton>
        </form>
      </AuthCard>
    </AuthPageLayout>
  );
}
