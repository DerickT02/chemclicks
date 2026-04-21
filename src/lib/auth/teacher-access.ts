import type { User } from "@supabase/supabase-js";

export function isTeacherEmailVerified(user: User | null): boolean {
  return Boolean(user?.email_confirmed_at);
}

export function getTeacherAccessRedirect(user: User | null): string | null {
  if (!user) return "/login/teacher";
  if (!isTeacherEmailVerified(user)) return "/login/teacher?verification=required";
  return null;
}

type AuthClaims = Record<string, unknown> | null | undefined;

/**
 * JWT-claims based gate for teacher routes (avoids network call to Auth server).
 */
export function isTeacherEmailVerifiedFromClaims(claims: AuthClaims): boolean {
  return Boolean(claims?.email_confirmed_at ?? claims?.email_verified);
}

export function getTeacherAccessRedirectFromClaims(
  claims: AuthClaims,
): string | null {
  if (!claims?.sub) return "/login/teacher";
  if (!isTeacherEmailVerifiedFromClaims(claims)) {
    return "/login/teacher?verification=required";
  }
  return null;
}
