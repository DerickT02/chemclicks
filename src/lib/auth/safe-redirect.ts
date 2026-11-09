/**
 * Resolves a post-auth `redirect_to` value to a same-origin path, or `/`.
 *
 * `redirectTo` must be the value as read from `URLSearchParams`, which has
 * already been percent-decoded once. It is not decoded again: a second decode
 * would change the meaning of legitimately encoded paths, and an encoded value
 * such as `/%2F%2Fevil.example.com` is harmless because it is always resolved
 * against `origin` and stays a path on this site.
 */
export function resolveSafeRedirectPath(redirectTo: string | null, origin: string): string {
  if (!redirectTo?.startsWith("/") || redirectTo.startsWith("//") || redirectTo.includes("\\")) {
    return "/";
  }

  let resolved: URL;
  try {
    resolved = new URL(redirectTo, origin);
  } catch {
    return "/";
  }

  // Catches inputs the URL parser normalizes to another host (for example,
  // tabs or newlines stripped from "/\t/evil.example.com").
  if (resolved.origin !== origin) {
    return "/";
  }

  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
