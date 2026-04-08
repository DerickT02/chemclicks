/** Rules for teacher sign-up (client-side; mirror in Supabase / server later). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const TEACHER_PASSWORD_MIN_LENGTH = 8;

export function validateTeacherEmail(email: string): string | undefined {
  const normalized = email.trim();
  if (!normalized) return "Email is required.";
  if (!EMAIL_RE.test(normalized)) return "Please enter a valid email address.";
  return undefined;
}

export type TeacherSignupResult =
  | { valid: true }
  | {
      valid: false;
      emailError?: string;
      passwordError?: string;
      confirmError?: string;
    };

export function validateTeacherSignup(
  email: string,
  password: string,
  confirmPassword: string,
): TeacherSignupResult {
  // Validate email
  const emailError = validateTeacherEmail(email);

  // Validate password
  let passwordError: string | undefined;

  if (password.length < TEACHER_PASSWORD_MIN_LENGTH) {
    passwordError = `Password must be at least ${TEACHER_PASSWORD_MIN_LENGTH} characters.`;
  } else if (!/[A-Za-z]/.test(password)) {
    passwordError = "Password must include at least one letter.";
  } else if (!/[0-9]/.test(password)) {
    passwordError = "Password must include at least one number.";
  }

  // Validate confirm password   
  let confirmError: string | undefined;
  if (confirmPassword.length === 0) {
    confirmError = "Please confirm your password.";
  } else if (password !== confirmPassword) {
    confirmError = "Passwords do not match.";
  }

  // Final check
  if (emailError || passwordError || confirmError) {
    return { valid: false, emailError, passwordError, confirmError };
  }

  return { valid: true };
}
