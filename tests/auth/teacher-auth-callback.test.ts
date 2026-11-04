import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  TEACHER_POST_VERIFY_PATH,
  TEACHER_RESET_PASSWORD_PATH,
} from "@/lib/auth/teacher-email-verification";

const APP_ORIGIN = "https://app.example.com";
const AUTH_CODE_ERROR_PATH = "/auth/auth-code-error";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { GET } from "@/app/auth/callback/route";

function callbackRequest(query: string): Request {
  const suffix = query.length > 0 ? `?${query}` : "";
  return new Request(`${APP_ORIGIN}/auth/callback${suffix}`);
}

function redirectLocation(response: Response): URL {
  const location = response.headers.get("Location");
  expect(location).toBeTruthy();
  return new URL(location!);
}

function expectSameOrigin(location: URL) {
  expect(location.origin).toBe(APP_ORIGIN);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
  mocks.createClient.mockResolvedValue({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  });
});

describe("teacher auth callback GET", () => {
  describe("successful code exchange", () => {
    it("redirects to teacher post-verification destination after email confirmation", async () => {
      const response = await GET(
        callbackRequest(`code=verify-code&redirect_to=${encodeURIComponent(TEACHER_POST_VERIFY_PATH)}`),
      );

      const location = redirectLocation(response);
      expectSameOrigin(location);
      expect(location.pathname).toBe(TEACHER_POST_VERIFY_PATH);
      expect(mocks.createClient).toHaveBeenCalledTimes(1);
      expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("verify-code");
    });

    it("redirects to teacher reset-password after recovery code exchange", async () => {
      const response = await GET(
        callbackRequest(`code=recovery-code&redirect_to=${encodeURIComponent(TEACHER_RESET_PASSWORD_PATH)}`),
      );

      const location = redirectLocation(response);
      expectSameOrigin(location);
      expect(location.pathname).toBe(TEACHER_RESET_PASSWORD_PATH);
      expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("recovery-code");
    });
  });

  describe("exchange failures", () => {
    it("does not exchange when code is missing", async () => {
      const response = await GET(
        callbackRequest(`redirect_to=${encodeURIComponent(TEACHER_RESET_PASSWORD_PATH)}`),
      );

      const location = redirectLocation(response);
      expectSameOrigin(location);
      expect(location.pathname).toBe(AUTH_CODE_ERROR_PATH);
      expect(mocks.createClient).not.toHaveBeenCalled();
      expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    });

    it.each([
      ["invalid code", { message: "Invalid auth code" }],
      ["expired code", { message: "Email link is invalid or has expired" }],
      ["already-used code", { message: "Auth code already used" }],
    ])("sends %s to auth-code-error instead of the protected destination", async (_label, error) => {
      mocks.exchangeCodeForSession.mockResolvedValue({ error });

      const response = await GET(
        callbackRequest(`code=bad-code&redirect_to=${encodeURIComponent(TEACHER_RESET_PASSWORD_PATH)}`),
      );

      const location = redirectLocation(response);
      expectSameOrigin(location);
      expect(location.pathname).toBe(AUTH_CODE_ERROR_PATH);
      expect(location.pathname).not.toBe(TEACHER_RESET_PASSWORD_PATH);
      expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("bad-code");
    });

    it("handles thrown exchange errors without sending the user to a success destination", async () => {
      mocks.exchangeCodeForSession.mockRejectedValue(new Error("network failure"));

      const response = await GET(
        callbackRequest(`code=throws&redirect_to=${encodeURIComponent(TEACHER_POST_VERIFY_PATH)}`),
      );

      const location = redirectLocation(response);
      expectSameOrigin(location);
      expect(location.pathname).toBe(AUTH_CODE_ERROR_PATH);
      expect(location.pathname).not.toBe(TEACHER_POST_VERIFY_PATH);
    });
  });

  describe("redirect_to safety", () => {
    it.each([
      ["allowed teacher reset path", TEACHER_RESET_PASSWORD_PATH, TEACHER_RESET_PASSWORD_PATH],
      ["allowed post-verify path", TEACHER_POST_VERIFY_PATH, TEACHER_POST_VERIFY_PATH],
      ["missing redirect", "", "/"],
      ["invalid relative value", "not-a-valid-route", "/"],
      ["absolute external URL", "https://evil.example.com", "/"],
      ["protocol-relative URL", "//evil.example.com", "/"],
      ["encoded protocol-relative path", "/%2F%2Fevil.example.com", "/"],
      ["encoded backslashes", "/%5C%5Cevil.example.com", "/"],
      ["javascript scheme", "javascript:alert(1)", "/"],
    ])("resolves %s safely (%s)", async (_label, redirectTo, expectedPath) => {
      const query = redirectTo
        ? `code=good&redirect_to=${encodeURIComponent(redirectTo)}`
        : "code=good";
      const response = await GET(callbackRequest(query));

      const location = redirectLocation(response);
      expectSameOrigin(location);
      expect(location.pathname).toBe(expectedPath);
      expect(location.hostname).toBe("app.example.com");
    });
  });
});
