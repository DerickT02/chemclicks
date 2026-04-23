"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AuthCard,
  AuthField,
  AuthFormError,
  AuthFooter,
  AuthPageLayout,
  AuthPrimaryButton,
  authSecondaryLinkClassName,
} from "@/components/auth/AuthPageLayout";
import { validateTeacherEmail } from "@/lib/auth/validate-teacher-signup";

export default function TeacherLoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const verificationRequired = searchParams.get("verification") === "required";

  async function handleForgottenPassword() {
    // TODO. Blank for SCRUM-184.
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setEmailError(undefined);
    setPasswordError(undefined);

    const nextEmailError = validateTeacherEmail(email);
    if (nextEmailError) {
      setEmailError(nextEmailError);
      return;
    }

    if (!password) {
      setPasswordError("Please enter a password.");
      return;
    }

    // Later: Supabase signInWithPassword logic will be wired here
  }

  return (
    <AuthPageLayout>
      <AuthCard
        title="Login"
        footer={
          <AuthFooter className="flex flex-col gap-2">
            <Link href="/create-account/teacher" className={authSecondaryLinkClassName}>
              Create account
            </Link>
            <button
              type="button"
              onClick={() => void handleForgottenPassword()}
              className={authSecondaryLinkClassName}
            >
              Forgot password?
            </button>
          </AuthFooter>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={handleLogin} noValidate>
          <AuthField
            id="email"
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
            id="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError(undefined);
            }}
            error={passwordError}
          />
          {verificationRequired ? (
            <AuthFormError message="Please verify your email before signing in to teacher features." />
          ) : null}
          <AuthPrimaryButton type="submit">Sign in</AuthPrimaryButton>
        </form>
      </AuthCard>
    </AuthPageLayout>
  );
}
