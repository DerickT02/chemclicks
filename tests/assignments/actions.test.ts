import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), query: vi.fn(), insert: vi.fn(), update: vi.fn(), refresh: vi.fn(), create: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.create }));
vi.mock("@/lib/db/class_activities", () => ({ insertClassActivity: mocks.insert, updateClassActivity: mocks.update }));
import { saveAssignment } from "@/app/admin/assignments/actions";

const classId = "11111111-1111-4111-8111-111111111111";
const activityId = "22222222-2222-4222-8222-222222222222";
const assignmentId = "33333333-3333-4333-8333-333333333333";
const initial = { status: "idle" as const, message: "" };
function form(values: Record<string, string | undefined> = {}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ class_id: classId, activity_id: activityId, ...values })) if (value !== undefined) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  const builder = { select: () => builder, eq: () => builder, maybeSingle: mocks.query };
  mocks.create.mockResolvedValue({ auth: { getUser: mocks.getUser }, from: () => builder });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "teacher" } }, error: null });
  mocks.query.mockResolvedValue({ data: { id: classId }, error: null });
  mocks.insert.mockResolvedValue({ data: { id: assignmentId }, error: null });
  mocks.update.mockResolvedValue({ data: { id: assignmentId }, error: null });
});

describe("teacher assignment action", () => {
  it.each([
    { class_id: "" },
    { activity_id: "" },
    { opens_at: "2026-02-30T12:00" },
    { opens_at: "2026-09-12T12:00", closes_at: "2026-09-12T12:00" },
    { opens_at: "2026-09-13T12:00", closes_at: "2026-09-12T12:00" },
  ])("rejects invalid form input before database access: %j", async (values) => {
    expect((await saveAssignment(initial, form(values))).status).toBe("error");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("rejects logged-out users and classes the teacher does not own", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await saveAssignment(initial, form())).status).toBe("error");
    mocks.query.mockResolvedValueOnce({ data: null, error: null });
    expect((await saveAssignment(initial, form())).status).toBe("error");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("converts UTC input and reports a successful save", async () => {
    const result = await saveAssignment(initial, form({ opens_at: "2026-09-12T12:34" }));
    expect(result.status).toBe("success");
    expect(mocks.insert).toHaveBeenCalledWith(expect.anything(), {
      class_id: classId, activity_id: activityId, opens_at: "2026-09-12T12:34:00.000Z", closes_at: null,
    });
    expect(mocks.refresh).toHaveBeenCalledWith("/admin");
  });
  it("updates the existing ID and clears blank dates", async () => {
    expect((await saveAssignment(initial, form({ assignment_id: assignmentId }))).status).toBe("success");
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), assignmentId, { opens_at: null, closes_at: null });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("rejects a mismatched assignment ID before updating", async () => {
    mocks.query.mockResolvedValueOnce({ data: { id: classId }, error: null }).mockResolvedValueOnce({ data: null, error: null });
    expect((await saveAssignment(initial, form({ assignment_id: assignmentId }))).status).toBe("error");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("reports duplicates without refreshing or claiming success", async () => {
    mocks.insert.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate" } });
    const result = await saveAssignment(initial, form());
    expect(result.status).toBe("error");
    expect(result.message).toContain("already assigned");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
