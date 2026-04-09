"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  AuthCard,
  AuthField,
  AuthFooter,
  AuthPageLayout,
  AuthPrimaryButton,
} from "@/components/auth/AuthPageLayout";
import { validateTeacherSignup } from "@/lib/auth/validate-teacher-signup";

export default function TeacherCreateAccountPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailError(undefined);
    setPasswordError(undefined);
    setConfirmError(undefined);

    const result = validateTeacherSignup(email, password, confirmPassword);
    if (!result.valid) {
      setEmailError(result.emailError);
      setPasswordError(result.passwordError);
      setConfirmError(result.confirmError);
      return;
    }

    // Supabase signUp will be wired here later
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
          <AuthPrimaryButton>Create account</AuthPrimaryButton>
        </form>
      </AuthCard>
    </AuthPageLayout>
  );
}
