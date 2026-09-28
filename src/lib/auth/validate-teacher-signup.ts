/** Rules for teacher sign-up (client-side; mirror in Supabase / server later). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const TEACHER_PASSWORD_MIN_LENGTH = 8;

/**
 * Disallowed special characters: " ' \ / ` ; $
 */
export const TEACHER_PASSWORD_FORBIDDEN_CHARS = "\"'\\/`;$";

/**
 * Regex matching any disallowed characters in the password.
 * Escapes: " ' \ / ` ; $
 */
const FORBIDDEN_PASSWORD_CHARS_RE = /["'\\/`;$]/;

/**
 * Printable ASCII special characters excluding the forbidden set (" ' \ / ` ; $)
 * and excluding standard alphanumerics [A-Za-z0-9].
 * Allowed: ! # % & ( ) * + , - . : < = > ? @ [ ] ^ _ { | } ~
 */
const ALLOWED_PASSWORD_SPECIAL_RE = /[!#%&()*+,\-.:<=>?@[\]^_{|}~]/;
export function validateTeacherDisplayName(displayName: string): string | undefined {
  const normalized = displayName.trim();
  if (!normalized) return "Display name is required.";
  return undefined;
}

export function validateTeacherEmail(email: string): string | undefined {
  const normalized = email.trim();
  if (!normalized) return "Email is required.";
  if (!EMAIL_RE.test(normalized)) return "Please enter a valid email address.";
  return undefined;
}

/**
 * Validates a teacher password against the following rules in order:
 * 1. Must not be empty.
 * 2. Must not contain whitespace or line breaks.
 * 3. Must not contain any forbidden special characters (" ' \ / ` ; $).
 * 4. Must be at least 8 characters long.
 * 5. Must include at least one letter.
 * 6. Must include at least one number.
 * 7. Must include at least one allowed special character.
 */
export function validateTeacherPassword(password: string): string | undefined {
  if (password.length === 0) {
    return "Password is required.";
  }
  if (/\s/.test(password)) {
    return "Password cannot contain spaces or line breaks.";
  }
  if (FORBIDDEN_PASSWORD_CHARS_RE.test(password)) {
    return "Password cannot contain any of: \" ' \\ / ` ; $";
  }
  if (password.length < TEACHER_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${TEACHER_PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[A-Za-z]/.test(password)) {
    return "Password must include at least one letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }
  if (!ALLOWED_PASSWORD_SPECIAL_RE.test(password)) {
    return "Password must include at least one special character, but not \" ' \\ / ` ; $";
  }
  return undefined;
}

export type TeacherSignupResult =
  | { valid: true }
  | {
      valid: false;
      displayNameError?: string;
      emailError?: string;
      passwordError?: string;
      confirmError?: string;
    };

export function validateTeacherSignup(
  displayName: string,
  email: string,
  password: string,
  confirmPassword: string,
): TeacherSignupResult {
  // Validate display name
  const displayNameError = validateTeacherDisplayName(displayName);

  // Validate email
  const emailError = validateTeacherEmail(email);

  // Validate password
  const passwordError = validateTeacherPassword(password);

  // Validate confirm password
  let confirmError: string | undefined;
  if (confirmPassword.length === 0) {
    confirmError = "Please confirm your password.";
  } else if (password !== confirmPassword) {
    confirmError = "Passwords do not match.";
  }

  // Final check
  if (displayNameError || emailError || passwordError || confirmError) {
    return { valid: false, displayNameError, emailError, passwordError, confirmError };
  }

  return { valid: true };
}

