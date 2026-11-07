import { describe, expect, it } from "vitest";

import { resolveSafeRedirectPath } from "@/lib/auth/safe-redirect";

const ORIGIN = "https://app.example.com";

describe("resolveSafeRedirectPath", () => {
  it("keeps the query string and hash of a same-origin path", () => {
    expect(resolveSafeRedirectPath("/admin?tab=classes#roster", ORIGIN)).toBe("/admin?tab=classes#roster");
  });

  it("does not decode percent-encoded characters a second time", () => {
    expect(resolveSafeRedirectPath("/admin?next=a%26b", ORIGIN)).toBe("/admin?next=a%26b");
  });

  it("keeps a path containing a literal percent sign instead of falling back to /", () => {
    expect(resolveSafeRedirectPath("/admin?score=100%", ORIGIN)).toBe("/admin?score=100%");
  });

  it.each([
    ["missing value", null],
    ["empty value", ""],
    ["relative value", "admin"],
    ["absolute URL", "https://evil.example.com/admin"],
    ["protocol-relative URL", "//evil.example.com"],
    ["backslash path", "/\\evil.example.com"],
    ["newline-separated protocol-relative path", "/\n/evil.example.com"],
  ])("falls back to / for a %s", (_label, redirectTo) => {
    expect(resolveSafeRedirectPath(redirectTo, ORIGIN)).toBe("/");
  });
});
