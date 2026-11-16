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
import { resendTeacherVerification } from "@/lib/auth/resend-teacher-verification";
import {
  buildTeacherPasswordResetRedirectTo,
  getTeacherPasswordResetMessage,
  getTeacherVerificationResentMessage,
} from "@/lib/auth/teacher-email-verification";
import { validateTeacherEmail } from "@/lib/auth/validate-teacher-signup";
import {
  DATABASE_RETRY_MESSAGE,
  EMAIL_NOT_CONFIRMED_MESSAGE,
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
  const [notice, setNotice] = useState<string | undefined>();
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(
    () => searchParams.get("verification") === "required",
  );
  const passwordWasReset = searchParams.get("password") === "reset";

  function startEmailRequest(purpose: string): string | undefined {
    setEmailError(undefined);
    setPasswordError(undefined);
    setFormError(undefined);
    setNotice(undefined);

    const normalizedEmail = email.trim();
    const nextEmailError = normalizedEmail
      ? validateTeacherEmail(normalizedEmail)
      : `Enter your email above to ${purpose}.`;
    if (nextEmailError) {
      setEmailError(nextEmailError);
      return undefined;
    }
    return normalizedEmail;
  }

  async function handleResendVerification() {
    const normalizedEmail = startEmailRequest("resend the verification email");
    if (!normalizedEmail) return;

    setIsSendingVerification(true);
    const result = await resendTeacherVerification(normalizedEmail, window.location.origin);
    if (result.sent) {
      // Generic message so we don't reveal whether the email has an unverified account.
      setNotice(getTeacherVerificationResentMessage(normalizedEmail));
    } else {
      setFormError(result.error);
    }
    setIsSendingVerification(false);
  }

  async function handleForgottenPassword() {
    const normalizedEmail = startEmailRequest("reset your password");
    if (!normalizedEmail) return;

    setIsSendingReset(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: buildTeacherPasswordResetRedirectTo(window.location.origin),
      });

      if (error) {
        setFormError(GENERIC_RETRY_MESSAGE);
        return;
      }

      // Generic message so we don't reveal whether the email has an account.
      setNotice(getTeacherPasswordResetMessage(normalizedEmail));
    } catch {
      setFormError(GENERIC_RETRY_MESSAGE);
    } finally {
      setIsSendingReset(false);
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setEmailError(undefined);
    setPasswordError(undefined);
    setFormError(undefined);
    setNotice(undefined);

    const nextEmailError = validateTeacherEmail(email);
    if (nextEmailError) {
      setEmailError(nextEmailError);
      return;
    }

    if (!password) {
      setPasswordError("Please enter a password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const normalizedEmail = email.trim();

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInError) {
        if (signInError.code === "email_not_confirmed") {
          setAwaitingVerification(true);
        } else {
          setFormError(INVALID_CREDENTIALS_MESSAGE);
        }
        setPassword("");
        return;
      }

      // Teacher membership is separate from student access; no administrator approval is required.
      const { data: teacher, error: teacherError } = await supabase
        .from("teachers")
        .select("id")
        .eq("id", signInData.user.id)
        .maybeSingle();

      if (teacherError || !teacher) {
        setFormError(teacherError
          ? DATABASE_RETRY_MESSAGE
          : "This account does not have a teacher profile. Sign in with a teacher account.");
        setPassword("");
        await supabase.auth.signOut();
        return;
      }

      router.push("/admin");
    } catch {
      setFormError(DATABASE_RETRY_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
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
            {awaitingVerification ? (
              <button
                type="button"
                onClick={() => void handleResendVerification()}
                disabled={isSendingVerification}
                className={authSecondaryLinkClassName}
              >
                {isSendingVerification ? "Sending verification email..." : "Resend verification email"}
              </button>
            ) : null}
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
          {awaitingVerification && !formError && !notice ? (
            <AuthFormError message={EMAIL_NOT_CONFIRMED_MESSAGE} />
          ) : null}
          {passwordWasReset && !notice ? (
            <p className="text-sm text-muted-foreground" role="status">
              Your password has been updated. Please sign in.
            </p>
          ) : null}
          {notice ? (
            <p className="text-sm text-muted-foreground" role="status">
              {notice}
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
