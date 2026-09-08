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
import { validateStudentID, validateStudentCode } from "@/lib/auth/validate-student-signup";
import { loginStudent } from "./actions";

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
    const result = await loginStudent(normalizedStudentID, normalizedCode);
    if (!result.ok) {
      if (result.field === "studentID") setStudentIDError(result.message);
      else if (result.field === "code") setCodeError(result.message);
      else setFormError(result.message);
      setIsSubmitting(false);
      return;
    }

    setStudentID(normalizedStudentID);
    setCode(normalizedCode);
    setIsSubmitting(false);
    setIsLoggedIn(true);
    window.location.href = "/";
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
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          {isLoggedIn ? (
            <p className="text-sm text-green-600">Student login successful.</p>
          ) : null}
          <AuthPrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </AuthPrimaryButton>
        </form>
      </AuthCard>
    </AuthPageLayout>
  );
}

