import {
  TEACHER_POST_VERIFY_PATH,
  TEACHER_RESET_PASSWORD_PATH,
  buildTeacherEmailRedirectTo,
  buildTeacherPasswordResetRedirectTo,
  getTeacherVerificationMessage,
} from "../../src/lib/auth/teacher-email-verification";
import { describe, expect, it } from "vitest";

describe("teacher email verification flow helpers", () => {
  it("builds auth callback redirect for post-verification teacher destination", () => {
    const result = buildTeacherEmailRedirectTo("https://app.example.com");

    expect(result).toBe(
      "https://app.example.com/auth/callback?redirect_to=%2Fadmin",
    );
    expect(result).toContain(encodeURIComponent(TEACHER_POST_VERIFY_PATH));
  });

  it("returns clear verification message and next step", () => {
    const message = getTeacherVerificationMessage("teacher@example.com");

    expect(message).toContain("verification link");
    expect(message).toContain("teacher@example.com");
    expect(message).toContain("verify your email");
    expect(message).toContain("Open your inbox and click the link");
  });

  it("builds auth callback redirect for teacher password recovery", () => {
    const result = buildTeacherPasswordResetRedirectTo("https://app.example.com");

    expect(result).toBe(
      "https://app.example.com/auth/callback?redirect_to=%2Flogin%2Fteacher%2Freset-password",
    );
    expect(result).toContain(encodeURIComponent(TEACHER_RESET_PASSWORD_PATH));
  });
});
