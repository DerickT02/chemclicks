import {
  getTeacherAccessRedirect,
  getTeacherAccessRedirectFromClaims,
  isTeacherEmailVerified,
  isTeacherEmailVerifiedFromClaims,
} from "../../src/lib/auth/teacher-access";
import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

function makeTeacherUser(emailConfirmedAt: string | null): User {
  const normalizedEmailConfirmedAt = emailConfirmedAt ?? undefined;

  return {
    id: "5bf5f641-c426-4ec1-a683-df07d3e47f0a",
    aud: "authenticated",
    role: "authenticated",
    email: "teacher@example.com",
    email_confirmed_at: normalizedEmailConfirmedAt,
    phone: "",
    confirmed_at: normalizedEmailConfirmedAt,
    last_sign_in_at: undefined,
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: "2026-04-21T01:00:00.000Z",
    updated_at: "2026-04-21T01:00:00.000Z",
    is_anonymous: false,
  };
}

describe("teacher protected access checks", () => {
  it("redirects unauthenticated users to teacher login", () => {
    expect(getTeacherAccessRedirect(null)).toBe("/login/teacher");
  });

  it("redirects unverified teacher users with verification hint", () => {
    const user = makeTeacherUser(null);

    expect(isTeacherEmailVerified(user)).toBe(false);
    expect(getTeacherAccessRedirect(user)).toBe(
      "/login/teacher?verification=required",
    );
  });

  it("allows verified teacher users through", () => {
    const user = makeTeacherUser("2026-04-21T01:10:00.000Z");

    expect(isTeacherEmailVerified(user)).toBe(true);
    expect(getTeacherAccessRedirect(user)).toBeNull();
  });

  it("redirects to login when claims are missing", () => {
    expect(getTeacherAccessRedirectFromClaims(null)).toBe("/login/teacher");
  });

  it("redirects unverified claim users to verification prompt", () => {
    const claims = { sub: "teacher-user-id", email_verified: false };

    expect(isTeacherEmailVerifiedFromClaims(claims)).toBe(false);
    expect(getTeacherAccessRedirectFromClaims(claims)).toBe(
      "/login/teacher?verification=required",
    );
  });

  it("allows verified claim users through", () => {
    const claims = { sub: "teacher-user-id", email_verified: true };

    expect(isTeacherEmailVerifiedFromClaims(claims)).toBe(true);
    expect(getTeacherAccessRedirectFromClaims(claims)).toBeNull();
  });
});
