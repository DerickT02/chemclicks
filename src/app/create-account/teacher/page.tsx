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
import { validateTeacherSignupPassword } from "@/lib/auth/validate-teacher-password";

export default function TeacherCreateAccountPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(undefined);
    setConfirmError(undefined);

    const result = validateTeacherSignupPassword(password, confirmPassword);
    if (!result.valid) {
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
          <AuthFooter className="text-zinc-600 dark:text-zinc-400">
            Already have an account?{" "}
            <Link
              href="/login/teacher"
              className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
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
