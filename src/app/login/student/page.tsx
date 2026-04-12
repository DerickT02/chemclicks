"use client";

import { useState, type FormEvent } from "react";
import {
  AuthCard,
  AuthField,
  AuthPageLayout,
  AuthPrimaryButton,
} from "@/components/auth/AuthPageLayout";
import { validateStudentUsername, validateStudentCode } from "@/lib/auth/validate-student-signup";

export default function StudentLoginPage() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setUsernameError(undefined);
    setCodeError(undefined);

    const nextUsernameError = validateStudentUsername(username);
    if (nextUsernameError) {
      setUsernameError(nextUsernameError);
      return;
    }

    if (!code) {
      setCodeError("Please enter a code.");
      return;
    }

    // Later: Supabase signInWithcode logic will be wired here
  }

  return (
    <AuthPageLayout>
      <AuthCard
        title="Login"
        footer={undefined}
      >
        <form className="flex flex-col gap-4" onSubmit={handleLogin} noValidate>
          <AuthField
            id="username"
            label="username"
            type="username"
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
            id="code"
            label="code"
            type="code"
            placeholder="123456"
            autoComplete="current-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (codeError) setCodeError(undefined);
            }}
            error={codeError}
          />
          <AuthPrimaryButton type="submit">Sign in</AuthPrimaryButton>
        </form>
      </AuthCard>
    </AuthPageLayout>
  );
}

