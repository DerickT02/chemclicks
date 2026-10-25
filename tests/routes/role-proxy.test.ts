import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  admin: vi.fn(), student: vi.fn(), teacher: vi.fn(), studentEq: vi.fn(), teacherFrom: vi.fn(),
}));
// Every session response carries cookies as if updateSession had just refreshed
// the session: a replacement token, and an old chunk being cleared.
const REFRESHED_COOKIES = [
  {
    name: "sb-chemclicks-auth-token", value: "refreshed-session",
    httpOnly: true, path: "/", sameSite: "lax", secure: true, maxAge: 34_560_000,
  },
  { name: "sb-chemclicks-auth-token.1", value: "", path: "/", maxAge: 0 },
] as const;
vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: async () => {
    const response = NextResponse.next();
    for (const cookie of REFRESHED_COOKIES) response.cookies.set(cookie);
    return { response, user: mocks.user, supabase: { from: mocks.teacherFrom } };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));

import proxy from "@/proxy";

const request = (path: string) => new NextRequest(new URL(path, "https://chemclicks.test"));

// Every page.tsx under a protected segment, as a URL. Route groups are dropped
// and dynamic segments get a sample value, so new pages are covered automatically.
function pageRoutes(segmentDir: string): string[] {
  const appDir = join(process.cwd(), "src", "app");
  return readdirSync(join(appDir, segmentDir), { recursive: true, encoding: "utf8" })
    .filter((file) => file.split(sep).at(-1) === "page.tsx")
    .map((file) => relative(appDir, join(appDir, segmentDir, file)).split(sep).slice(0, -1))
    .map((parts) => "/" + parts
      .filter((part) => !/^\(.*\)$/.test(part))
      .map((part) => part.replace(/^\[(.+)\]$/, "sample-$1"))
      .join("/"))
    .sort();
}

function expectRefreshedCookies(response: NextResponse) {
  for (const cookie of REFRESHED_COOKIES) {
    expect(response.cookies.get(cookie.name)).toEqual(expect.objectContaining(cookie));
  }
}

const adminPages = pageRoutes("admin");
const studentPages = pageRoutes("(student)");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user = { id: "current-user" };
  mocks.admin.mockReturnValue({ from: () => ({ select: () => ({ eq: mocks.studentEq }) }) });
  mocks.studentEq.mockReturnValue({ maybeSingle: mocks.student });
  mocks.student.mockResolvedValue({ data: null, error: null });
  mocks.teacherFrom.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: mocks.teacher }) }) });
  mocks.teacher.mockResolvedValue({ data: { id: "current-user" }, error: null });
});

describe("admin route proxy", () => {
  it("redirects signed-in students to their dashboard, even with a legacy teacher profile", async () => {
    mocks.student.mockResolvedValue({ data: { id: "student-row" }, error: null });
    const response = await proxy(request("/admin/classes?classId=1"));
    expect(response.headers.get("location")).toBe("https://chemclicks.test/student");
    expect(mocks.studentEq).toHaveBeenCalledWith("auth_user_id", "current-user");
    expect(mocks.teacherFrom).not.toHaveBeenCalled();
  });

  it("fails closed when the student lookup errors", async () => {
    mocks.student.mockResolvedValue({ data: null, error: { message: "private error" } });
    const response = await proxy(request("/admin"));
    expect(response.headers.get("location")).toBe("https://chemclicks.test/forbidden");
  });

  it("allows approved teachers through", async () => {
    const response = await proxy(request("/admin"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("forbids signed-in users without a teacher record", async () => {
    mocks.teacher.mockResolvedValue({ data: null, error: null });
    const response = await proxy(request("/admin"));
    expect(response.headers.get("location")).toBe("https://chemclicks.test/forbidden");
  });

  it("does not look up roles outside protected routes", async () => {
    await proxy(request("/help"));
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.teacherFrom).not.toHaveBeenCalled();
  });
});

describe("student route proxy", () => {
  it("redirects signed-in teachers to the admin dashboard", async () => {
    const response = await proxy(request("/student/labs?tab=1"));
    expect(response.headers.get("location")).toBe("https://chemclicks.test/admin");
    expect(mocks.studentEq).toHaveBeenCalledWith("auth_user_id", "current-user");
  });

  it("lets students through, even with a legacy teacher profile", async () => {
    mocks.student.mockResolvedValue({ data: { id: "student-row" }, error: null });
    const response = await proxy(request("/student"));
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.teacherFrom).not.toHaveBeenCalled();
  });

  it("leaves signed-out users and lookup failures to the student layout", async () => {
    mocks.user = null;
    expect((await proxy(request("/student"))).headers.get("location")).toBeNull();
    expect(mocks.admin).not.toHaveBeenCalled();

    mocks.user = { id: "current-user" };
    mocks.student.mockResolvedValue({ data: null, error: { message: "private error" } });
    expect((await proxy(request("/student"))).headers.get("location")).toBeNull();
    expect(mocks.teacherFrom).not.toHaveBeenCalled();
  });

  it("does not redirect signed-in users without a teacher record", async () => {
    mocks.teacher.mockResolvedValue({ data: null, error: null });
    const response = await proxy(request("/student"));
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("role redirects for every protected page", () => {
  it("finds the protected pages", () => {
    expect(adminPages).toContain("/admin");
    expect(adminPages).toContain("/admin/classes/sample-classId/attempts");
    expect(studentPages).toContain("/student");
    expect(studentPages).toContain("/student/assignments/sample-assignmentId/history");
  });

  describe("student", () => {
    beforeEach(() => {
      mocks.student.mockResolvedValue({ data: { id: "student-row" }, error: null });
    });

    it.each(adminPages)("is redirected from %s to /student", async (path) => {
      const response = await proxy(request(path));
      expect(response.headers.get("location")).toBe("https://chemclicks.test/student");
    });

    it.each(studentPages)("can open %s", async (path) => {
      const response = await proxy(request(path));
      expect(response.headers.get("location")).toBeNull();
    });
  });

  describe("teacher", () => {
    it.each(studentPages)("is redirected from %s to /admin", async (path) => {
      const response = await proxy(request(path));
      expect(response.headers.get("location")).toBe("https://chemclicks.test/admin");
    });

    it.each(adminPages)("can open %s", async (path) => {
      const response = await proxy(request(path));
      expect(response.headers.get("location")).toBeNull();
    });
  });
});

describe("refreshed session cookies", () => {
  async function expectRedirectKeepsCookies(path: string, location: string) {
    const response = await proxy(request(path));
    expect(response.headers.get("location")).toBe(`https://chemclicks.test${location}`);
    expectRefreshedCookies(response);
    // The browser receives every cookie on the redirect, not just the latest one.
    const setCookie = response.headers.getSetCookie();
    expect(setCookie).toHaveLength(REFRESHED_COOKIES.length);
    expect(setCookie[0]).toMatch(/HttpOnly/i);
    expect(setCookie[0]).toMatch(/SameSite=lax/i);
    expect(setCookie[0]).toMatch(/Path=\//);
  }

  it("survive the student redirect away from /admin", async () => {
    mocks.student.mockResolvedValue({ data: { id: "student-row" }, error: null });
    await expectRedirectKeepsCookies("/admin", "/student");
  });

  it("survive the teacher redirect away from /student", async () => {
    await expectRedirectKeepsCookies("/student", "/admin");
  });

  it("survive the redirect when the student lookup fails", async () => {
    mocks.student.mockResolvedValue({ data: null, error: { message: "private error" } });
    await expectRedirectKeepsCookies("/admin", "/forbidden");
  });

  it("survive the redirect when the user has no teacher record", async () => {
    mocks.teacher.mockResolvedValue({ data: null, error: null });
    await expectRedirectKeepsCookies("/admin", "/forbidden");
  });

  it("survive the sign-in redirect outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      mocks.user = null;
      await expectRedirectKeepsCookies("/admin/labs", "/login/teacher?redirectedFrom=%2Fadmin%2Flabs");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("are kept when the request passes through", async () => {
    const response = await proxy(request("/admin"));
    expect(response.headers.get("location")).toBeNull();
    expectRefreshedCookies(response);
  });
});
