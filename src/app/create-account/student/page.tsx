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
import { normalizeAuthUsername } from "@/lib/auth/validate-auth-username";
import { validateStudentSignup } from "@/lib/auth/validate-student-signup";

export default function StudentCreateAccountPage() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setUsernameError(undefined);
    setCodeError(undefined);

    const result = validateStudentSignup(username, code);
    if (!result.valid) {
      setUsernameError(result.usernameError);
      setCodeError(result.codeError);
      return;
    }

    setUsername(normalizeAuthUsername(username));
    setCode(code.trim());

    // Supabase sign-up will be wired here later
  }

  return (
    <AuthPageLayout>
      <AuthCard
        title="Create account"
        footer={
          <AuthFooter className="text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login/student"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </AuthFooter>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <AuthField
            id="signup-username"
            label="Username"
            type="text"
            placeholder="myName123"
            autoComplete="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (usernameError) setUsernameError(undefined);
            }}
            error={usernameError}
          />
          <AuthField
            id="signup-classroom-code"
            label="Classroom code"
            type="text"
            placeholder="123456"
            autoComplete="off"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (codeError) setCodeError(undefined);
            }}
            error={codeError}
          />
          <AuthPrimaryButton>Create account</AuthPrimaryButton>
        </form>
      </AuthCard>
    </AuthPageLayout>
  );
}
