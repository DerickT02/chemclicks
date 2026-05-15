import { validateAuthUsernameInput } from "@/lib/auth/validate-auth-username";

/** Rules for student sign-up */

export function validateStudentUsername(username: string): string | undefined {
  return validateAuthUsernameInput(username).error;
}

export type StudentSignupResult =
  | { valid: true }
  | { valid: false; firstNameError?: string; lastNameError?: string; studentIDError?: string; codeError?: string };

export function validateStudentSignup(
  firstName: string,
  lastName: string,
  studentID: string,
  code: string,
): StudentSignupResult {
  const firstNameError = validateFirstName(firstName);
  const lastNameError = validateLastName(lastName);
  const studentIDError = validateStudentID(studentID);
  const codeError = validateStudentCode(code);

  if (firstNameError || lastNameError || studentIDError || codeError) {
    return { valid: false, firstNameError, lastNameError, studentIDError, codeError };
  }

  return { valid: true };
}

export function validateFirstName(firstName: string): string | undefined {
    const trimmed = firstName.trim();
    if(trimmed.length === 0) {
        return "Please enter your first name.";
    }
    // TODO SCRUM-228: we do not yet know the restrictions the client wants on names
    return undefined;
}

export function validateLastName(lastName: string): string | undefined {
    const trimmed = lastName.trim();
    if(trimmed.length === 0) {
        return "Please enter your last name.";
    }
    // TODO SCRUM-228: we do not yet know the restrictions the client wants on names
    return undefined;
}

export function validateStudentID(studentID: string): string | undefined {
    const trimmed = studentID.trim();
    if(trimmed.length === 0) {
        return "Please enter a Student ID.";
    }
    // TODO SCRUM-228: we do not yet know the proper format
    return undefined;
}

export function validateStudentCode(code: string): string | undefined {
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return "Please enter a code.";
  }
  // TODO: Scrum-187 — additional classroom code rules (length, charset, …)
  return undefined;
}