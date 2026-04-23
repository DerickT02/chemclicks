export const TEACHER_POST_VERIFY_PATH = "/admin";

export function buildTeacherEmailRedirectTo(origin: string): string {
  return `${origin}/auth/callback?redirect_to=${encodeURIComponent(TEACHER_POST_VERIFY_PATH)}`;
}

export function getTeacherVerificationMessage(email: string): string {
  return `We sent a verification link to ${email}. Open your inbox and click the link to verify your email and finish creating your teacher account.`;
}
