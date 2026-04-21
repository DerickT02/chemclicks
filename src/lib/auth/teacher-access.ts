import type { User } from "@supabase/supabase-js";

export function isTeacherEmailVerified(user: User | null): boolean {
  return Boolean(user?.email_confirmed_at);
}

export function getTeacherAccessRedirect(user: User | null): string | null {
  if (!user) return "/login/teacher";
  if (!isTeacherEmailVerified(user)) return "/login/teacher?verification=required";
  return null;
}
