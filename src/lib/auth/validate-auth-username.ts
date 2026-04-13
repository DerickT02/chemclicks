/**
 * Shared rules for username-style identifiers in auth forms (student login, sign-up, etc.).
 * Always trim before validating or sending to the backend.
 */

export const AUTH_USERNAME_REQUIRED_MESSAGE = "Please enter a username.";

/** Mirrors teacher email invalid copy: "Please enter a valid email address." */
export const AUTH_USERNAME_INVALID_MESSAGE = "Please enter a valid username.";

/** Letters, numbers, underscore; 3–32 characters (after trim). */
const USERNAME_FORMAT_RE = /^[a-zA-Z0-9_]{3,32}$/;

export function normalizeAuthUsername(raw: string): string {
  return raw.trim();
}

function usernameFormatError(trimmed: string): string | undefined {
  if (!USERNAME_FORMAT_RE.test(trimmed)) {
    return AUTH_USERNAME_INVALID_MESSAGE;
  }
  return undefined;
}

/**
 * Trims `raw` and returns a client validation error if the username is missing or invalid.
 * Use `trimmedUsername` for API calls when `error` is undefined.
 */
export function validateAuthUsernameInput(raw: string): {
  trimmedUsername: string;
  error?: string;
} {
  const trimmedUsername = normalizeAuthUsername(raw);
  if (trimmedUsername.length === 0) {
    return { trimmedUsername, error: AUTH_USERNAME_REQUIRED_MESSAGE };
  }
  const formatError = usernameFormatError(trimmedUsername);
  if (formatError) {
    return { trimmedUsername, error: formatError };
  }
  return { trimmedUsername };
}
