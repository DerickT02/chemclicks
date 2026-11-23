import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.getClaims, getUser: mocks.getUser } }),
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
    mocks.getClaims.mockResolvedValue({ data: null });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(AdminLayout({ children: null })).rejects.toThrow(/^REDIRECT:\/login\/teacher$/);
  });

  it("redirects unverified teachers to the verification prompt", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "teacher-user-id", role: "authenticated" } },
    });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "teacher-user-id" } }, error: null });
    await expect(AdminLayout({ children: null })).rejects.toThrow(
      "REDIRECT:/login/teacher?verification=required",
    );
  });

  it("renders children for a verified teacher whose access token has no email verification claim", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "teacher-user-id", role: "authenticated" } },
    });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "teacher-user-id", email_confirmed_at: "2026-11-21T07:00:00Z" } },
      error: null,
    });
    const view = await AdminLayout({ children: <p>Protected admin</p> });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(view)).toContain("<p>Protected admin</p>");
  });

  it("redirects to login if the server cannot verify the session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("Auth unavailable") });
    await expect(AdminLayout({ children: null })).rejects.toThrow(/^REDIRECT:\/login\/teacher$/);
  });
});
