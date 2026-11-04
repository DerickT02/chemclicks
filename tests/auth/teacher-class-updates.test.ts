import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ teacher: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/server/teacher", () => ({ requireTeacherId: mocks.teacher }));
vi.mock("@/lib/server/database", () => ({ createServiceClient: () => ({ rpc: mocks.rpc }) }));
import { getTeacherClassUpdates, isClassUpdateCursor } from "@/lib/server/teacher-class-updates";
import { GET } from "@/app/admin/classes/[classId]/updates/route";

const classId = "11111111-1111-4111-8111-111111111111";
const assignmentId = "22222222-2222-4222-8222-222222222222";
const data = { classId, revision: "42", reset: false, removedStudentIds: [], roster: null, progress: null, attempts: null };
const request = (query = "", id = classId) => GET(new Request(`https://chemclicks.test/admin/classes/${id}/updates${query}`), {
  params: Promise.resolve({ classId: id }),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.teacher.mockResolvedValue("verified-session-teacher");
  mocks.rpc.mockResolvedValue({ data, error: null });
});

describe("combined teacher class updates", () => {
  it("authenticates once and performs one RPC for both roster and progress", async () => {
    const response = await request("?after=40&teacherId=untrusted");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual(data);
    expect(mocks.teacher).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("teacher_class_updates", {
      p_teacher_id: "verified-session-teacher", p_class_id: classId, p_after: "40", p_assignment_id: null,
    });
  });
  it("preserves large revision precision and supports the selected assignment overview", async () => {
    expect((await request(`?after=9007199254740993&assignmentId=${assignmentId}`)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenLastCalledWith("teacher_class_updates", expect.objectContaining({ p_after: "9007199254740993", p_assignment_id: assignmentId }));
  });
  it("requests a full baseline when no cursor is provided", async () => {
    await getTeacherClassUpdates(classId);
    expect(mocks.rpc).toHaveBeenCalledWith("teacher_class_updates", expect.objectContaining({ p_after: null }));
  });
  it.each(["", "-1", "01", "1.2", "NaN", "9223372036854775808", "9999999999999999999999999"])("rejects invalid cursor %j before authentication or reads", async cursor => {
    expect(isClassUpdateCursor(cursor)).toBe(false);
    expect((await request(`?after=${cursor}`)).status).toBe(400);
    expect(mocks.teacher).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["0", "1", "9223372036854775807"])("accepts valid cursor %s", cursor => {
    expect(isClassUpdateCursor(cursor)).toBe(true);
  });
  it("rejects invalid class or assignment IDs without reads", async () => {
    expect((await request("", "invalid")).status).toBe(400);
    expect((await request("?assignmentId=invalid")).status).toBe(400);
    await expect(getTeacherClassUpdates(classId, { after: "-1" })).rejects.toThrow("Invalid");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("denies unauthenticated callers without querying and never leaks private error details", async () => {
    mocks.teacher.mockRejectedValue(new Error("private session details"));
    const response = await request();
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("private session details");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([{ data: null, error: null }, { data: null, error: { message: "private database details" } }])("fails closed when ownership or database reads fail (%j)", async result => {
    mocks.rpc.mockResolvedValue(result);
    const response = await request();
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("private database details");
  });
});
