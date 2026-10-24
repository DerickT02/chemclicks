import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  admin: vi.fn(), student: vi.fn(), teacher: vi.fn(), studentEq: vi.fn(), teacherFrom: vi.fn(),
}));
vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: async () => ({
    response: NextResponse.next(),
    user: mocks.user,
    supabase: { from: mocks.teacherFrom },
  }),
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
