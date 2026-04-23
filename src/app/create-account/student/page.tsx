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
import { validateStudentSignup } from "@/lib/auth/validate-student-signup";

export default function StudentCreateAccountPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentID, setStudentID] = useState("");
  const [code, setCode] = useState("");
  const [firstNameError, setFirstNameError] = useState<string | undefined>();
  const [lastNameError, setLastNameError] = useState<string | undefined>();
  const [studentIDError, setStudentIDError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFirstNameError(undefined);
    setLastNameError(undefined);
    setStudentIDError(undefined);
    setCodeError(undefined);

    const result = validateStudentSignup(firstName, lastName, studentID, code);
    if (!result.valid) {
      setFirstNameError(result.firstNameError);
      setLastNameError(result.lastNameError);
      setStudentIDError(result.studentIDError);
      setCodeError(result.codeError);
      return;
    }

    setFirstName(firstName.trim());
    setLastName(lastName.trim());
    setStudentID(studentID.trim());
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
            id="signup-first-name"
            label="First Name"
            type="text"
            placeholder="John"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              if (firstNameError) setFirstNameError(undefined);
            }}
            error={firstNameError}
          />
          <AuthField
            id="signup-last-name"
            label="Last Name"
            type="text"
            placeholder="Smith"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              if (lastNameError) setLastNameError(undefined);
            }}
            error={lastNameError}
          />
          <AuthField
            id="signup-student-id"
            label="Student ID"
            type="text"
            placeholder="Student ID Placeholder" // TODO SCRUM-228: we do not yet know the format, this may be invalid
            value={studentID}
            onChange={(e) => {
              setStudentID(e.target.value);
              if (studentIDError) setStudentIDError(undefined);
            }}
            error={studentIDError}
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
