import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ roster: vi.fn() }));
vi.mock("@/lib/server/student-roster", () => ({ getOwnedStudentRoster: mocks.roster }));
import { GET } from "@/app/admin/classes/[classId]/roster/route";

const classId = "11111111-1111-4111-8111-111111111111";
const request = (id = classId) => GET(
  new Request(`https://chemclicks.test/admin/classes/${id}/roster?teacherId=untrusted`),
  { params: Promise.resolve({ classId: id }) },
);

beforeEach(() => vi.resetAllMocks());

describe("live student roster reads", () => {
  it("uses the authorized reader for the selected class and never caches student data", async () => {
    const data = { pending: [{ id: "student", first_name: "Alex", last_name: "Waiting", student_id: "TEST1", verified: false }], active: [] };
    mocks.roster.mockResolvedValue(data);
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual(data);
    expect(mocks.roster).toHaveBeenCalledExactlyOnceWith(classId);
  });

  it("returns fresh pending and active rows on subsequent requests, including empty rosters", async () => {
    mocks.roster.mockResolvedValueOnce({ pending: [], active: [] });
    expect(await (await request()).json()).toEqual({ pending: [], active: [] });
    const data = { pending: [{ id: "new-request" }], active: [{ id: "approved" }] };
    mocks.roster.mockResolvedValueOnce(data);
    expect(await (await request()).json()).toEqual(data);
    expect(mocks.roster).toHaveBeenCalledTimes(2);
  });

  it.each(["signed out", "student session", "foreign class", "disabled class", "database failure"])(
    "fails closed without leaking reader errors: %s", async reason => {
      mocks.roster.mockRejectedValue(new Error(`private details: ${reason}`));
      const response = await request();
      expect(response.status).toBe(403);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(await response.json()).toEqual({ error: "Student roster access denied or unavailable." });
    },
  );

  it("rejects malformed class IDs without calling the reader", async () => {
    const response = await request("invalid");
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.roster).not.toHaveBeenCalled();
  });
});
