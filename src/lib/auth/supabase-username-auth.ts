import type { AuthError } from "@supabase/supabase-js";

/**
 * User-facing copy when the server rejects the username (unknown user, invalid credentials, etc.).
 * Supabase often uses the same error for wrong password and missing user; treat as “username not found”
 * only in username-first flows where this wording matches the product.
 */
export const AUTH_USERNAME_NOT_FOUND_MESSAGE =
  "We couldn’t find an account with that username.";

/**
 * Maps a Supabase `AuthError` from sign-in to a short message for the username field or form.
 * Returns `null` when `error` is null/undefined.
 *
 * Typical wiring in a client submit handler after `signIn…`:
 * `const msg = messageForSupabaseUsernameAuthError(error);`
 * `if (msg) setUsernameError(msg);` — or `setFormError(msg)` for non-field-specific failures.
 */
export function messageForSupabaseUsernameAuthError(
  error: AuthError | null | undefined,
): string | null {
  if (!error) return null;

  const code = (error.code ?? "").toLowerCase();
  const msg = (error.message ?? "").toLowerCase();

  if (
    code === "invalid_credentials" ||
    code === "user_not_found" ||
    msg.includes("invalid login credentials") ||
    msg.includes("user not found") ||
    msg.includes("invalid email or password")
  ) {
    return AUTH_USERNAME_NOT_FOUND_MESSAGE;
  }

  return error.message?.trim() || "Something went wrong. Please try again.";
}
