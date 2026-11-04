import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ lessons: vi.fn(), attempts: vi.fn() }));
vi.mock("@/lib/server/teacher-lesson-progress", () => ({ getTeacherClassLessonProgress: mocks.lessons }));
vi.mock("@/lib/server/teacher-attempts", () => ({ getTeacherActivityAttemptSummary: mocks.attempts }));
import { GET } from "@/app/admin/classes/[classId]/progress/route";

const classId = "11111111-1111-4111-8111-111111111111";
const assignmentId = "22222222-2222-4222-8222-222222222222";
const request = (query = "", id = classId) => GET(
  new Request(`https://chemclicks.test/admin/classes/${id}/progress${query}`),
  { params: Promise.resolve({ classId: id }) },
);

beforeEach(() => vi.resetAllMocks());

describe("live teacher progress reads", () => {
  it("reads current class progress through the authorized server reader without caching", async () => {
    const data = { classId, className: "Chemistry", students: [] };
    mocks.lessons.mockResolvedValue(data);
    const response = await request("?teacherId=untrusted");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual(data);
    expect(mocks.lessons).toHaveBeenCalledExactlyOnceWith(classId);
    expect(mocks.attempts).not.toHaveBeenCalled();
  });

  it("scopes attempt reads to the requested class and assignment", async () => {
    mocks.attempts.mockResolvedValue({ classId, assignmentId, students: [] });
    expect((await request(`?assignmentId=${assignmentId}`)).status).toBe(200);
    expect(mocks.attempts).toHaveBeenCalledExactlyOnceWith(classId, assignmentId, { live: true });
    expect(mocks.lessons).not.toHaveBeenCalled();
  });

  it.each(["lessons", "attempts"] as const)("fails closed when the %s reader denies access or fails", async reader => {
    mocks[reader].mockRejectedValue(new Error("private database/session details"));
    const response = await request(reader === "attempts" ? `?assignmentId=${assignmentId}` : "");
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.text()).not.toContain("private database/session details");
  });

  it.each([["", "invalid"], ["?assignmentId=invalid", classId], ["?assignmentId=", classId]])(
    "rejects malformed IDs before reading (%s, %s)", async (query, id) => {
      expect((await request(query, id)).status).toBe(400);
      expect(mocks.lessons).not.toHaveBeenCalled();
      expect(mocks.attempts).not.toHaveBeenCalled();
    },
  );
});
