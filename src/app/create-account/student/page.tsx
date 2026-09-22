"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AuthCard,
  AuthField,
  AuthFooter,
  AuthPageLayout,
  AuthPrimaryButton,
} from "@/components/auth/AuthPageLayout";
import { validateStudentSignup } from "@/lib/auth/validate-student-signup";
import { insertStudent } from "@/lib/db/students";
import { createClient } from "@/lib/supabase/client";

export default function StudentCreateAccountPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentID, setStudentID] = useState("");
  const [code, setCode] = useState("");
  const [firstNameError, setFirstNameError] = useState<string | undefined>();
  const [lastNameError, setLastNameError] = useState<string | undefined>();
  const [studentIDError, setStudentIDError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFirstNameError(undefined);
    setLastNameError(undefined);
    setStudentIDError(undefined);
    setCodeError(undefined);
    setFormError(undefined);

    const result = validateStudentSignup(firstName, lastName, studentID, code);
    if (!result.valid) {
      setFirstNameError(result.firstNameError);
      setLastNameError(result.lastNameError);
      setStudentIDError(result.studentIDError);
      setCodeError(result.codeError);
      return;
    }

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedStudentID = studentID.trim();
    const normalizedCode = code.trim().toUpperCase();

    setIsSubmitting(true);

    const supabase = createClient();
    const { data: classRow, error: classError } = await supabase
      .from("classes")
      .select("id, is_active")
      .eq("class_code", normalizedCode)
      .maybeSingle();

    if (classError) {
      setFormError(classError.message);
      setIsSubmitting(false);
      return;
    }

    if (!classRow) {
      setCodeError("That classroom code was not found.");
      setIsSubmitting(false);
      return;
    }

    if (!classRow.is_active) {
      setCodeError("That classroom is inactive.");
      setIsSubmitting(false);
      return;
    }

    const { error: studentError } = await insertStudent(supabase, {
      class_id: classRow.id,
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
      student_id: normalizedStudentID,
    });

    if (studentError) {
      setFormError(studentError.message);
      setIsSubmitting(false);
      return;
    }

    setFirstName(normalizedFirstName);
    setLastName(normalizedLastName);
    setStudentID(normalizedStudentID);
    setCode(normalizedCode);
    router.replace("/?accountCreated=true");

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
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <AuthPrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </AuthPrimaryButton>
        </form>
      </AuthCard>
    </AuthPageLayout>
  );
}
