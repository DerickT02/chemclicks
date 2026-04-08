/** Rules for teacher sign-up (client-side; mirror in Supabase / server later). */
export const TEACHER_PASSWORD_MIN_LENGTH = 8;

export type TeacherSignupPasswordResult =
  | { valid: true }
  | {
      valid: false;
      passwordError?: string;
      confirmError?: string;
    };

export function validateTeacherSignupPassword(
  password: string,
  confirmPassword: string,
): TeacherSignupPasswordResult {
  let passwordError: string | undefined;

  if (password.length < TEACHER_PASSWORD_MIN_LENGTH) {
    passwordError = `Password must be at least ${TEACHER_PASSWORD_MIN_LENGTH} characters.`;
  } else if (!/[A-Za-z]/.test(password)) {
    passwordError = "Password must include at least one letter.";
  } else if (!/[0-9]/.test(password)) {
    passwordError = "Password must include at least one number.";
  }

  let confirmError: string | undefined;
  if (confirmPassword.length === 0) {
    confirmError = "Please confirm your password.";
  } else if (password !== confirmPassword) {
    confirmError = "Passwords do not match.";
  }

  if (passwordError || confirmError) {
    return { valid: false, passwordError, confirmError };
  }

  return { valid: true };
}
