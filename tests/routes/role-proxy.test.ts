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
