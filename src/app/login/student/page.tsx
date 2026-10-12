"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AuthCard,
  AuthField,
  AuthFormError,
  AuthFooter,
  AuthPageLayout,
  AuthPrimaryButton,
  authSecondaryLinkClassName
} from "@/components/auth/AuthPageLayout";
import { validateStudentID, validateStudentCode } from "@/lib/auth/validate-student-signup";
import { loginStudent } from "./actions";
import { SESSION_RETRY_MESSAGE } from "@/lib/errors/user-facing-errors";

export default function StudentLoginPage() {
  const [studentID, setStudentID] = useState("");
  const [code, setCode] = useState("");
  const [studentIDError, setStudentIDError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setStudentIDError(undefined);
    setCodeError(undefined);
    setFormError(undefined);
    setIsLoggedIn(false);

    const normalizedStudentID = studentID.trim();
    const normalizedCode = code.trim().toUpperCase();
    const studentIDValidationError = validateStudentID(normalizedStudentID);
    if (studentIDValidationError) {
      setStudentIDError(studentIDValidationError);
      return;
    }

    const codeValidationError = validateStudentCode(normalizedCode);
    if (codeValidationError) {
      setCodeError(codeValidationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await loginStudent(normalizedStudentID, normalizedCode);
      if (!result.ok) {
        if (result.field === "studentID") setStudentIDError(result.message);
        else if (result.field === "code") setCodeError(result.message);
        else setFormError(result.message);
        return;
      }

      setStudentID(normalizedStudentID);
      setCode(normalizedCode);
      setIsLoggedIn(true);
      // Reload the document so shared layouts see the newly established session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentionally discard pre-login layout state
      window.location.assign("/student");
    } catch {
      setIsLoggedIn(false);
      setFormError(SESSION_RETRY_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageLayout>
      <AuthCard
        title="Student Login"
        footer={
          <AuthFooter className="flex flex-col gap-2">
            <Link href="/create-account/student" className={authSecondaryLinkClassName}>
              Join a class
            </Link>
            <Link href="/login/teacher" className={authSecondaryLinkClassName}>
              Not a student?
            </Link>
          </AuthFooter>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={handleLogin} noValidate>
          <AuthField
            id="student-id"
            label="Student ID"
            type="text"
            placeholder="Student ID"
            autoComplete="off"
            value={studentID}
            onChange={(e) => {
              setStudentID(e.target.value);
              if (studentIDError) setStudentIDError(undefined);
            }}
            error={studentIDError}
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
          <AuthFormError message={formError} />
          {isLoggedIn ? (
            <p className="text-sm text-muted-foreground" role="status">Signed in. Opening your assignments...</p>
          ) : null}
          <AuthPrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </AuthPrimaryButton>
        </form>
      </AuthCard>
    </AuthPageLayout>
  );
}

