import { createClient } from "@/lib/supabase/server";

/**
 * Fresh user record from the Auth server (network call). Use when you need latest metadata or roles.
 */
export async function getAuthUser() {
  const supabase = await createClient();
  return supabase.auth.getUser();
}
