"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AuthCard,
  AuthField,
  AuthFooter,
  AuthPageLayout,
  AuthPrimaryButton,
  authSecondaryLinkClassName
} from "@/components/auth/AuthPageLayout";
import { validateAuthUsernameInput } from "@/lib/auth/validate-auth-username";
import { validateStudentCode } from "@/lib/auth/validate-student-signup";

export default function StudentLoginPage() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    setUsernameError(undefined);
    setCodeError(undefined);

    const { trimmedUsername, error: usernameValidationError } =
      validateAuthUsernameInput(username);
    if (usernameValidationError) {
      setUsernameError(usernameValidationError);
      return;
    }
    setUsername(trimmedUsername);

    const codeValidationError = validateStudentCode(code);
    if (codeValidationError) {
      setCodeError(codeValidationError);
      return;
    }
    setCode(code.trim());
  }

  return (
    <AuthPageLayout>
      <AuthCard
        title="Student Login"
        footer={
          <AuthFooter className="flex flex-col gap-2">
            <Link href="/login/teacher" className={authSecondaryLinkClassName}>
              Not a student?
            </Link>
          </AuthFooter>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={handleLogin} noValidate>
          <AuthField
            id="username"
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
            id="code"
            label="Classroom code"
            type="text"
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

