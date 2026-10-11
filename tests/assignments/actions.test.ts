import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  teacher: vi.fn(), writer: {}, admin: vi.fn(), getUser: vi.fn(), query: vi.fn(), insert: vi.fn(), update: vi.fn(), refresh: vi.fn(), create: vi.fn(), eq: vi.fn(), select: vi.fn(),
}));
vi.mock('@/lib/server/teacher', () => ({ requireTeacherId: mocks.teacher }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }));
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
  for (const [key, value] of Object.entries({ class_id: classId, activity_id: activityId, ...(values.assignment_id ? { confirm_schedule_change: "true" } : {}), ...values })) if (value !== undefined) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.teacher.mockResolvedValue("teacher");
  mocks.admin.mockReturnValue(mocks.writer);
  const builder = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.query };
  mocks.select.mockReturnValue(builder);
  mocks.eq.mockReturnValue(builder);
  mocks.create.mockResolvedValue({ auth: { getUser: mocks.getUser }, from: () => builder });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "teacher" } }, error: null });
  mocks.query.mockResolvedValue({ data: { id: classId, type: "lewis_diagram" }, error: null });
  mocks.insert.mockResolvedValue({ data: { id: assignmentId, class_id: classId, activity_id: activityId, opens_at: null, closes_at: null }, error: null });
  mocks.update.mockResolvedValue({ data: { id: assignmentId, class_id: classId, activity_id: activityId, opens_at: null, closes_at: null }, error: null });
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
  it.each([
    "bohr_model_intro", "bohr_model_stability", "measurement_ruler_hundredths", "future_activity", "constructor",
  ])("rejects new unsupported %s assignments using stored metadata before privileged writes", async (type) => {
    mocks.query.mockResolvedValueOnce({ data: { id: classId }, error: null })
      .mockResolvedValueOnce({ data: { id: activityId, type }, error: null });
    const result = await saveAssignment(initial, form({ activity_type: "lewis_diagram", assignable: "true" }));
    expect(result.status).toBe("error");
    expect(result.message).not.toBe("");
    expect(mocks.select).toHaveBeenCalledWith("id, type");
    expect(mocks.eq).toHaveBeenCalledWith("teacher_id", "teacher");
    expect(mocks.eq).toHaveBeenCalledWith("is_active", true);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("allows date updates on existing unsupported assignments without creating new work", async () => {
    mocks.query.mockResolvedValue({ data: { id: assignmentId, type: "bohr_model_intro" }, error: null });
    expect((await saveAssignment(initial, form({ assignment_id: assignmentId }))).status).toBe("success");
    expect(mocks.update).toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalledWith("id, type");
  });

  it.each([null, { id: activityId }])("rejects missing or malformed activity metadata (%j)", async (activity) => {
    mocks.query.mockResolvedValueOnce({ data: { id: classId }, error: null })
      .mockResolvedValueOnce({ data: activity, error: null });
    expect((await saveAssignment(initial, form())).status).toBe("error");
    expect(mocks.admin).not.toHaveBeenCalled();
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
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), assignmentId, { opens_at: null, closes_at: null }, undefined);
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

describe("schedule editing safeguards", () => {
  it("saves ordinary date edits without an extra confirmation step", async () => {
    mocks.query.mockResolvedValue({ data: { id: assignmentId, opens_at: null, closes_at: null }, error: null });
    const data = form({ assignment_id: assignmentId });
    data.delete("confirm_schedule_change");
    expect((await saveAssignment(initial, data)).status).toBe("success");
    expect(mocks.update).toHaveBeenCalledOnce();
  });
  it("requires confirmation on the server when an edit immediately closes open work", async () => {
    mocks.query.mockResolvedValue({ data: { id: assignmentId, opens_at: null, closes_at: null }, error: null });
    const data = form({ assignment_id: assignmentId, closes_at: "2000-01-01T12:00" });
    data.delete("confirm_schedule_change");
    expect((await saveAssignment(initial, data)).message).toContain("Confirm saving");
    expect(mocks.admin).not.toHaveBeenCalled();
    data.set("confirm_schedule_change", "true");
    expect((await saveAssignment(initial, data)).status).toBe("success");
  });
  it("sends the expected window and relationship context to the conditional writer", async () => {
    mocks.query.mockResolvedValue({ data: { id: assignmentId, opens_at: null, closes_at: null }, error: null });
    const result = await saveAssignment(initial, form({ assignment_id: assignmentId, original_opens_at: "", original_closes_at: "", closes_at: "2026-09-12T12:30:00.789" }));
    expect(result.status).toBe("success");
    expect(mocks.update).toHaveBeenCalledWith(mocks.writer, assignmentId,
      { opens_at: null, closes_at: "2026-09-12T12:30:00.789Z" },
      { class_id: classId, activity_id: activityId, opens_at: null, closes_at: null });
    expect(mocks.eq).toHaveBeenCalledWith("activity_id", activityId);
    expect(mocks.refresh).toHaveBeenCalledWith("/student", "layout");
  });
  it("retains unchanged original precision rather than rewriting a rounded timestamp", async () => {
    const original = "2026-09-12T11:00:00.123456+00:00";
    mocks.query.mockResolvedValue({ data: { id: assignmentId, opens_at: original, closes_at: null }, error: null });
    await saveAssignment(initial, form({ assignment_id: assignmentId, original_opens_at: original, original_closes_at: "", opens_at: "2026-09-12T11:00:00.123", closes_at: "2026-09-12T12:30" }));
    expect(mocks.update.mock.calls[0][2].opens_at).toBe(original);
  });
  it("rejects stale snapshots before obtaining a privileged writer", async () => {
    mocks.query.mockResolvedValue({ data: { id: assignmentId, opens_at: null, closes_at: "2026-09-12T13:00Z" }, error: null });
    const result = await saveAssignment(initial, form({ assignment_id: assignmentId, original_opens_at: "", original_closes_at: "" }));
    expect(result.message).toContain("schedule changed");
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("rejects updates after the owned class becomes inactive or unavailable", async () => {
    mocks.query.mockResolvedValueOnce({ data: null, error: null });
    expect((await saveAssignment(initial, form({ assignment_id: assignmentId }))).status).toBe("error");
    expect(mocks.eq).toHaveBeenCalledWith("is_active", true);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("reports conditional conflicts without success or revalidation", async () => {
    mocks.update.mockResolvedValue({ data: null, error: { code: "CONFLICT", message: "The schedule changed. Cancel and reopen the editor before trying again." } });
    expect((await saveAssignment(initial, form({ assignment_id: assignmentId }))).message).toContain("schedule changed");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("keeps a confirmed write successful when cache refresh fails, with a saved receipt", async () => {
    mocks.refresh.mockImplementation(() => { throw new Error("private cache failure"); });
    const result = await saveAssignment(initial, form({ assignment_id: assignmentId }));
    expect(result.status).toBe("success");
    expect(result.message).toContain("Refresh the page");
    expect(result.message).not.toContain("private");
    expect(result.savedAssignment?.id).toBe(assignmentId);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("date validation", () => {
  it.each([
    { opens_at: "not a date" },
    { opens_at: "2026-02-30T10:00" },
    { closes_at: "2026-09-12T15:00Z" },
  ])("rejects unparseable dates before database access: %j", async values => {
    const result = await saveAssignment(initial, form(values));
    expect(result).toEqual({ status: "error", message: "Enter valid opening and closing dates." });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});

it('does not perform privileged writes when teacher authorization fails', async () => {
  mocks.teacher.mockRejectedValue(new Error('Unauthorized'));
  expect((await saveAssignment(initial, form())).status).toBe('error');
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});
