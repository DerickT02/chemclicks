"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import {
  AuthCard,
  AuthField,
  AuthFormError,
  AuthFooter,
  AuthPageLayout,
  AuthPrimaryButton,
  authSecondaryLinkClassName,
} from "@/components/auth/AuthPageLayout";
import {
  buildTeacherPasswordResetRedirectTo,
  getTeacherPasswordResetMessage,
} from "@/lib/auth/teacher-email-verification";
import { validateTeacherEmail } from "@/lib/auth/validate-teacher-signup";
import {
  GENERIC_RETRY_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
} from "@/lib/errors/user-facing-errors";
import { createClient } from "@/lib/supabase/client";

export default function TeacherLoginPage() {
  return (
    <Suspense fallback={<TeacherLoginFallback />}>
      <TeacherLoginForm />
    </Suspense>
  );
}

function TeacherLoginFallback() {
  return (
    <AuthPageLayout>
      <AuthCard title="Teacher Login">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </AuthCard>
    </AuthPageLayout>
  );
}

function TeacherLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | undefined>();
  const [isSendingReset, setIsSendingReset] = useState(false);
  const verificationRequired = searchParams.get("verification") === "required";
  const passwordWasReset = searchParams.get("password") === "reset";

  async function handleForgottenPassword() {
    setEmailError(undefined);
    setPasswordError(undefined);
    setFormError(undefined);
    setResetNotice(undefined);

    if (!email.trim()) {
      setEmailError("Enter your email above to reset your password.");
      return;
    }

    const nextEmailError = validateTeacherEmail(email);
    if (nextEmailError) {
      setEmailError(nextEmailError);
      return;
    }

    setIsSendingReset(true);

    const supabase = createClient();
    const normalizedEmail = email.trim();

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: buildTeacherPasswordResetRedirectTo(window.location.origin),
    });

    if (error) {
      setFormError(GENERIC_RETRY_MESSAGE);
      setIsSendingReset(false);
      return;
    }

    // Generic message so we don't reveal whether the email has an account.
    setResetNotice(getTeacherPasswordResetMessage(normalizedEmail));
    setIsSendingReset(false);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setEmailError(undefined);
    setPasswordError(undefined);
    setFormError(undefined);
    setResetNotice(undefined);

    const nextEmailError = validateTeacherEmail(email);
    if (nextEmailError) {
      setEmailError(nextEmailError);
      setPassword("");
      return;
    }

    if (!password) {
      setPasswordError("Please enter a password.");
      return;
    }

    setIsSubmitting(true);

    const supabase = createClient();
    const normalizedEmail = email.trim();

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError) {
      setFormError(INVALID_CREDENTIALS_MESSAGE);
      setPassword("");
      setIsSubmitting(false);
      return;
    }

    // Confirm the user has an approved teacher account in public.teachers
    const { data: teacher, error: teacherError } = await supabase
      .from("teachers")
      .select("id")
      .eq("id", signInData.user.id)
      .maybeSingle();

    if (teacherError || !teacher) {
      await supabase.auth.signOut();
      setFormError("This account is not approved as a teacher. Please contact your administrator.");
      setPassword("");
      setIsSubmitting(false);
      return;
    }

    router.push("/admin");
  }

  return (
    <AuthPageLayout>
      <AuthCard
        title="Teacher Login"
        footer={
          <AuthFooter className="flex flex-col gap-2">
            <Link href="/create-account/teacher" className={authSecondaryLinkClassName}>
              Create account
            </Link>
            <button
              type="button"
              onClick={() => void handleForgottenPassword()}
              disabled={isSendingReset}
              className={authSecondaryLinkClassName}
            >
              {isSendingReset ? "Sending reset link..." : "Forgot password?"}
            </button>
            <Link href="/login/student" className={authSecondaryLinkClassName}>
              Not a teacher?
            </Link>
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
          {passwordWasReset && !resetNotice ? (
            <p className="text-sm text-muted-foreground" role="status">
              Your password has been updated. Please sign in.
            </p>
          ) : null}
          {resetNotice ? (
            <p className="text-sm text-muted-foreground" role="status">
              {resetNotice}
            </p>
          ) : null}
          <AuthFormError message={formError} />
          <AuthPrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </AuthPrimaryButton>
        </form>
      </AuthCard>
    </AuthPageLayout>
  );
}
