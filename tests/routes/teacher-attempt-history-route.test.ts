import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ summary: vi.fn() }));
vi.mock("@/lib/server/teacher-attempts", () => ({ getTeacherActivityAttemptSummary: mocks.summary }));
import { GET } from "@/app/admin/classes/[classId]/attempt-history/route";

const classId = "11111111-1111-4111-8111-111111111111";
const assignmentId = "22222222-2222-4222-8222-222222222222";
const studentId = "33333333-3333-4333-8333-333333333333";
const request = (query = `assignmentId=${assignmentId}&studentId=${studentId}`) => GET(
  new Request(`https://chemclicks.test/admin/classes/${classId}/attempt-history?${query}`),
  { params: Promise.resolve({ classId }) },
);
beforeEach(() => vi.resetAllMocks());

describe("lazy attempt history", () => {
  it("returns only the selected student's history through the authorized reader", async () => {
    const attempts = [{ id: "attempt" }];
    mocks.summary.mockResolvedValue({ students: [{ studentId, attempts }] });
    const response = await request();
    expect(mocks.summary).toHaveBeenCalledExactlyOnceWith(classId, assignmentId, { live: true, studentId });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual(attempts);
  });
  it("rejects a student outside the selected class/assignment", async () => {
    mocks.summary.mockResolvedValue({ students: [] });
    expect((await request()).status).toBe(404);
  });
  it("never exposes data or database/session details on failure", async () => {
    mocks.summary.mockRejectedValue(new Error("private details"));
    const response = await request();
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("private details");
  });
  it.each(["", `assignmentId=${assignmentId}`, `assignmentId=${assignmentId}&studentId=bad`, `assignmentId=bad&studentId=${studentId}`])("rejects invalid query %s before reading", async query => {
    expect((await request(query)).status).toBe(400);
    expect(mocks.summary).not.toHaveBeenCalled();
  });
});
