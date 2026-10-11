import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), schedules: vi.fn(), service: vi.fn(), progress: vi.fn(), page: vi.fn(), eq: vi.fn(), select: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/student-session", () => ({ getStudentSession: mocks.session }));
vi.mock("@/lib/db/student-assignments", () => ({ getStudentAssignmentSchedules: mocks.schedules }));
vi.mock("@/lib/server/database", () => ({ createServiceClient: mocks.service }));
import { getAssignmentAttempts } from "@/lib/server/student-assignments";

const assignment = { id: "own", opens_at: null, closes_at: "2000-01-01T00:00Z", activity: { type: "lewis_diagram" } };
const record = { id: "attempt", attempt_number: 1, status: "completed", started_at: "1999-01-01T00:00Z", completed_at: "1999-01-02T00:00Z" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ studentId: "student", classId: "class" });
  mocks.schedules.mockResolvedValue({ status: "ok", assignments: [assignment] });
  mocks.progress.mockResolvedValue({ data: { id: "own-progress" }, error: null });
  mocks.page.mockResolvedValue({ data: [record], error: null });
  mocks.service.mockImplementation(() => ({ from: () => {
    const builder = {
      select: (fields: string) => { mocks.select(fields); return builder; },
      eq: (column: string, value: string) => { mocks.eq(column, value); return builder; },
      order: () => builder,
      maybeSingle: mocks.progress,
      returns: mocks.page,
    };
    return builder;
  } }));
});

describe("authorized closed-history reads", () => {
  it("reads only the signed-in student's progress and its saved exploration fields, without an RPC or mutation", async () => {
    expect(await getAssignmentAttempts("own")).toEqual([record]);
    expect(mocks.eq).toHaveBeenCalledWith("student_id", "student");
    expect(mocks.eq).toHaveBeenCalledWith("class_activity_id", "own");
    expect(mocks.eq).toHaveBeenCalledWith("progress_id", "own-progress");
    expect(mocks.select).toHaveBeenCalledWith("id, attempt_number, status, started_at, completed_at");
    expect(mocks.page).toHaveBeenCalledTimes(1);
  });
  it.each(["foreign", "future", "invalid", "inactive", "error"])("denies %s history before privileged reads", async kind => {
    if (kind === "foreign") mocks.schedules.mockResolvedValue({ status: "ok", assignments: [] });
    if (kind === "future" || kind === "invalid") mocks.schedules.mockResolvedValue({ status: "ok", assignments: [{ ...assignment, opens_at: kind === "future" ? "9999-01-01T00:00Z" : "bad", closes_at: null }] });
    if (kind === "inactive" || kind === "error") mocks.schedules.mockResolvedValue({ status: kind === "inactive" ? "unauthenticated" : "error" });
    await expect(getAssignmentAttempts("own")).rejects.toThrow("Assignment unavailable");
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("denies a missing session before schedule or progress reads", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(getAssignmentAttempts("own")).rejects.toThrow("sign in");
    expect(mocks.schedules).not.toHaveBeenCalled();
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("returns an honest empty history only after a successful missing-progress read", async () => {
    mocks.progress.mockResolvedValue({ data: null, error: null });
    expect(await getAssignmentAttempts("own")).toEqual([]);
    expect(mocks.page).not.toHaveBeenCalled();
    mocks.progress.mockResolvedValue({ data: null, error: { message: "private" } });
    await expect(getAssignmentAttempts("own")).rejects.toThrow("Progress could not be loaded");
  });
  it("fails when the attempts read fails", async () => {
    mocks.page.mockResolvedValue({ data: null, error: { message: "private" } });
    await expect(getAssignmentAttempts("own")).rejects.toThrow("Attempts could not be loaded");
  });
});
