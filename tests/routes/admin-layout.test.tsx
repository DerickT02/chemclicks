import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/server", () => ({
  getAuthClaims: async () => mocks.getClaims(),
}));

import AdminLayout from "@/app/admin/layout";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
});

describe("admin layout teacher gate", () => {
  it("redirects signed-out users to teacher login", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null } });
    await expect(AdminLayout({ children: null })).rejects.toThrow("REDIRECT:/login/teacher");
  });

  it("redirects unverified teachers to the verification prompt", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "teacher-user-id", email_verified: false } },
    });
    await expect(AdminLayout({ children: null })).rejects.toThrow(
      "REDIRECT:/login/teacher?verification=required",
    );
  });

  it("renders children for a verified teacher session", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "teacher-user-id", email_verified: true } },
    });
    const view = await AdminLayout({ children: <p>Protected admin</p> });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(view).toBeTruthy();
  });
});
