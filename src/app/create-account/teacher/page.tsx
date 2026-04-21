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
import { validateTeacherSignup } from "@/lib/auth/validate-teacher-signup";
import { createClient } from "@/lib/supabase/client";

export default function TeacherCreateAccountPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
            We sent a verification link to <span className="font-medium text-foreground">{email}</span>.
            Open your inbox and click the link to finish creating your teacher
            account.
          </p>
        </AuthCard>
      </AuthPageLayout>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailError(undefined);
    setPasswordError(undefined);
    setConfirmError(undefined);
    setFormError(undefined);

    const result = validateTeacherSignup(email, password, confirmPassword);
    if (!result.valid) {
      setEmailError(result.emailError);
      setPasswordError(result.passwordError);
      setConfirmError(result.confirmError);
      return;
    }

    setIsSubmitting(true);

    const supabase = createClient();
    const normalizedEmail = email.trim();
    const emailRedirectTo = `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent("/teacher/dashboard")}`;

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      setFormError(error.message || "Could not create account. Please try again.");
      setIsSubmitting(false);
      return;
    }

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
