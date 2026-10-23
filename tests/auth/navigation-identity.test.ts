import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), student: vi.fn(), teacher: vi.fn(), admin: vi.fn(),
  studentFrom: vi.fn(), teacherFrom: vi.fn(), studentEq: vi.fn(), teacherEq: vi.fn(),
  classroom: vi.fn(), classEq: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.teacherFrom }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));

import { getNavigationIdentity } from "@/lib/auth/navigation";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "current-user", email_confirmed_at: "now" } }, error: null });
  mocks.studentFrom.mockImplementation((table: string) => ({
    select: () => ({ eq: table === "classes" ? mocks.classEq : mocks.studentEq }),
  }));
  mocks.studentEq.mockReturnValue({ maybeSingle: mocks.student });
  mocks.classEq.mockReturnValue({ eq: mocks.classEq, maybeSingle: mocks.classroom });
  mocks.classroom.mockResolvedValue({ data: { id: "student-class" }, error: null });
  mocks.teacherFrom.mockReturnValue({ select: () => ({ eq: mocks.teacherEq }) });
  mocks.teacherEq.mockReturnValue({ maybeSingle: mocks.teacher });
  mocks.admin.mockReturnValue({ from: mocks.studentFrom });
  mocks.student.mockResolvedValue({ data: null, error: null });
  mocks.teacher.mockResolvedValue({ data: null, error: null });
});

describe("verified navigation identity", () => {
  it.each([null, { name: "AuthSessionMissingError" }])("renders signed-out navigation for missing sessions (%j)", async (error) => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error });
    expect(await getNavigationIdentity()).toEqual({ status: "signed-out" });
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("does not turn a failed Auth read into a successful sign-out check", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthRetryableFetchError", message: "private error" } });
    expect(await getNavigationIdentity()).toEqual({ status: "error" });
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("handles thrown Auth failures without leaking details", async () => {
    mocks.getUser.mockRejectedValue(new Error("private configuration"));
    expect(await getNavigationIdentity()).toEqual({ status: "error" });
  });

  it("uses student linking before teacher membership, including conflicting legacy profiles", async () => {
    mocks.student.mockResolvedValue({ data: { id: "student-row", class_id: "student-class", verified: true }, error: null });
    mocks.teacher.mockResolvedValue({ data: { id: "current-user" }, error: null });
    expect(await getNavigationIdentity()).toEqual({ status: "signed-in", role: "student" });
    expect(mocks.studentFrom).toHaveBeenCalledWith("students");
    expect(mocks.studentEq).toHaveBeenCalledWith("auth_user_id", "current-user");
    expect(mocks.studentFrom).toHaveBeenCalledWith("classes");
    expect(mocks.classEq).toHaveBeenCalledWith("id", "student-class");
    expect(mocks.classEq).toHaveBeenCalledWith("is_active", true);
    expect(mocks.teacherFrom).not.toHaveBeenCalled();
  });

  it("does not impose teacher email verification on approved students", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "student-user" } }, error: null });
    mocks.student.mockResolvedValue({ data: { id: "student-row", class_id: "student-class", verified: true }, error: null });
    expect(await getNavigationIdentity()).toEqual({ status: "signed-in", role: "student" });
  });

  it("withholds dashboard access for disabled/missing classes without offering teacher navigation", async () => {
    mocks.student.mockResolvedValue({ data: { id: "student-row", class_id: "disabled-class", verified: true }, error: null });
    mocks.classroom.mockResolvedValue({ data: null, error: null });
    mocks.teacher.mockResolvedValue({ data: { id: "current-user" }, error: null });
    expect(await getNavigationIdentity()).toEqual({
      status: "signed-in", role: null, message: "Your classroom is inactive or unavailable. Please contact your teacher.",
    });
    expect(mocks.classEq).toHaveBeenCalledWith("id", "disabled-class");
    expect(mocks.classEq).toHaveBeenCalledWith("is_active", true);
    expect(mocks.teacherFrom).not.toHaveBeenCalled();
  });

  it.each(["returned", "thrown"])("fails closed on %s class lookup errors while preserving sign out", async (failure) => {
    mocks.student.mockResolvedValue({ data: { id: "student-row", class_id: "student-class", verified: true }, error: null });
    if (failure === "returned") mocks.classroom.mockResolvedValue({ data: null, error: { message: "private error" } });
    else mocks.classroom.mockRejectedValue(new Error("private error"));
    expect(await getNavigationIdentity()).toEqual({
      status: "signed-in", role: null, message: "Your dashboard could not be loaded. Please try again.",
    });
    expect(mocks.teacherFrom).not.toHaveBeenCalled();
  });

  it("withholds student and legacy teacher dashboards while approval is pending", async () => {
    mocks.student.mockResolvedValue({ data: { id: "student-row", class_id: "student-class", verified: false }, error: null });
    mocks.teacher.mockResolvedValue({ data: { id: "current-user" }, error: null });
    expect(await getNavigationIdentity()).toEqual({
      status: "signed-in", role: null, message: expect.stringContaining("awaiting teacher approval"),
    });
    expect(mocks.classroom).not.toHaveBeenCalled();
    expect(mocks.teacherFrom).not.toHaveBeenCalled();
  });

  it("requires verified teacher membership for the teacher dashboard shortcut", async () => {
    mocks.teacher.mockResolvedValue({ data: { id: "current-user" }, error: null });
    expect(await getNavigationIdentity()).toEqual({ status: "signed-in", role: "teacher" });
    expect(mocks.teacherFrom).toHaveBeenCalledWith("teachers");
    expect(mocks.teacherEq).toHaveBeenCalledWith("id", "current-user");
  });

  it("ignores user-editable metadata roles", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "current-user", email_confirmed_at: "now", user_metadata: { role: "teacher" } } }, error: null });
    expect(await getNavigationIdentity()).toEqual({ status: "signed-in", role: null });
  });

  it("does not offer teacher navigation before email verification", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "current-user" } }, error: null });
    expect(await getNavigationIdentity()).toEqual({ status: "signed-in", role: null });
    expect(mocks.teacherFrom).not.toHaveBeenCalled();
  });

  it.each(["student lookup", "teacher lookup", "configuration"])("keeps sign out available and fails closed when %s fails", async (failure) => {
    if (failure === "configuration") mocks.admin.mockImplementation(() => { throw new Error("private service key"); });
    else if (failure === "student lookup") mocks.student.mockResolvedValue({ data: null, error: { message: "private error" } });
    else mocks.teacher.mockResolvedValue({ data: null, error: { message: "private error" } });
    expect(await getNavigationIdentity()).toEqual({
      status: "signed-in", role: null, message: "Your dashboard could not be loaded. Please try again.",
    });
    if (failure !== "teacher lookup") expect(mocks.teacherFrom).not.toHaveBeenCalled();
  });

  it("does not resolve anonymous users to either classroom role", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "anonymous", is_anonymous: true } }, error: null });
    expect(await getNavigationIdentity()).toEqual({ status: "signed-in", role: null });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});
