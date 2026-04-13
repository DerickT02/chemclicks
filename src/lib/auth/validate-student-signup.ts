import { validateAuthUsernameInput } from "@/lib/auth/validate-auth-username";

/** Rules for student sign-up */

export function validateStudentUsername(username: string): string | undefined {
  return validateAuthUsernameInput(username).error;
}

export type StudentSignupResult =
  | { valid: true }
  | { valid: false; usernameError?: string; codeError?: string };

export function validateStudentSignup(
  username: string,
  code: string,
): StudentSignupResult {
  const { error: usernameError } = validateAuthUsernameInput(username);
  const codeError = validateStudentCode(code);

  if (usernameError || codeError) {
    return { valid: false, usernameError, codeError };
  }

  return { valid: true };
}

export function validateStudentCode(code: string): string | undefined {
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return "Please enter a code.";
  }
  // TODO: Scrum-187 — additional classroom code rules (length, charset, …)
  return undefined;
}