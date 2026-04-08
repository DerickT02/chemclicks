import { createClient } from "@/lib/supabase/server";

/**
 * Verified JWT claims — safe for authorization (unlike getSession() from cookies alone).
 * @see https://github.com/supabase/ssr#known-patterns-and-limitations
 */
export async function getAuthClaims() {
  const supabase = await createClient();
  return supabase.auth.getClaims();
}

/**
 * Fresh user record from the Auth server (network call). Use when you need latest metadata or roles.
 */
export async function getAuthUser() {
  const supabase = await createClient();
  return supabase.auth.getUser();
}
