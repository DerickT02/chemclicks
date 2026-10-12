import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), admin: vi.fn(), read: vi.fn(),
  calls: [] as { table: string; method: string; args: unknown[] }[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/student-session", () => ({ getStudentSession: mocks.session }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
import { getStudentWorkQueue } from "@/lib/server/student-work-queue";
import type { StudentAssignment } from "@/lib/db/student-assignments";

const studentId = "11111111-1111-4111-8111-111111111111";
const classId = "22222222-2222-4222-8222-222222222222";
const failed = { data: null, error: { message: "private" } };
const queueError = { status: "error", message: "Your assignments could not be loaded. Please try again." };
type AssignmentRow = StudentAssignment & { class_id: string };
const assignment = (id: string, overrides: Partial<AssignmentRow> = {}): AssignmentRow => ({
  id, class_id: classId, opens_at: null, closes_at: null,
  activity: { id: `activity-${id}`, title: id, type: "lewis_diagram", order_index: 1 }, ...overrides,
});
let assignments: AssignmentRow[];
let progress: { class_activity_id: string; status: string }[];
const calls = (table: string, method: string) => mocks.calls.filter(call => call.table === table && call.method === method);
const tables = () => mocks.calls.filter(call => call.method === "select").map(call => call.table);
/** Replace one table's response; every other table keeps the default fixture. */
function override(table: string, result: unknown) {
  const read = mocks.read.getMockImplementation()!;
  mocks.read.mockImplementation(t => t === table ? result : read(t));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  assignments = [assignment("a"), assignment("b"), assignment("c")];
  progress = [
    { class_activity_id: "b", status: "in_progress" },
    { class_activity_id: "c", status: "completed" },
  ];
  mocks.session.mockResolvedValue({ studentId, classId });
  mocks.read.mockImplementation((table: string) => {
    if (table === "students") return { data: { id: studentId, class_id: classId, first_name: "Alex", last_name: "Student", login_id: "private-login" }, error: null };
    if (table === "classes") return { data: { id: classId, name: "Chemistry", section: "A", is_active: true, class_code: "private-code" }, error: null };
    return { data: structuredClone(table === "class_activities" ? assignments : progress), error: null };
  });
  mocks.admin.mockImplementation(() => ({ from: (table: string) => {
    const builder: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of ["select", "eq", "is", "in", "order"]) {
      builder[method] = (...args: unknown[]) => {
        mocks.calls.push({ table, method, args });
        return builder;
      };
    }
    builder.maybeSingle = builder.returns = async () => mocks.read(table);
    return builder;
  } }));
});

async function queue() {
  const result = await getStudentWorkQueue();
  if (result.status !== "ok") throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
  return result;
}

describe("authorized student work queue", () => {
  it("maps stored progress, defaults a missing row to not started, and reads each table once with ownership filters", async () => {
    const result = await queue();
    expect(result.assignments.map(row => row.progress)).toEqual(["not_started", "in_progress", "completed"]);
    expect(result.context).toEqual({ studentName: "Alex Student", className: "Chemistry", section: "A" });
    expect(result.progressError).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/private-login|private-code|student_id|class_id|score|passed/);
    expect(tables()).toEqual(["students", "classes", "class_activities", "student_progress"]);
    // Unassigned (archived) work must not reappear in the student's list.
    expect(calls("class_activities", "is").map(call => call.args)).toEqual([["archived_at", null]]);
    expect(calls("students", "eq").map(call => call.args)).toEqual([["id", studentId], ["class_id", classId]]);
    expect(calls("classes", "eq").map(call => call.args)).toEqual([["id", classId], ["is_active", true]]);
    expect(calls("class_activities", "eq").map(call => call.args)).toEqual([["class_id", classId]]);
    expect(calls("student_progress", "eq").map(call => call.args)).toEqual([["student_id", studentId]]);
    expect(calls("student_progress", "in").map(call => call.args)).toEqual([["class_activity_id", ["a", "b", "c"]]]);
  });

  it("gives future/closed/invalid/unsupported work null progress and only asks for open exercises", async () => {
    assignments = [assignment("open"), assignment("future", { opens_at: "9999-01-01T00:00:00Z" }),
      assignment("closed", { closes_at: "2000-01-01T00:00:00Z" }), assignment("invalid", { closes_at: "bad" }),
      assignment("unsupported", { activity: { id: "future", title: "Future", type: "future_activity" as AssignmentRow["activity"]["type"], order_index: 1 } }),
    ];
    const result = await queue();
    expect(result.assignments.map(row => [row.id, row.progress])).toEqual([
      ["open", "not_started"], ["future", null], ["closed", null], ["invalid", null], ["unsupported", null],
    ]);
    expect(calls("student_progress", "in").map(call => call.args)).toEqual([["class_activity_id", ["open"]]]);
    expect(mocks.calls.filter(call => call.method === "select").some(call => String(call.args[0]).includes("*"))).toBe(false);
  });

  it("skips the progress read when no supported work is open", async () => {
    assignments = [assignment("closed", { closes_at: "2000-01-01T00:00:00Z" })];
    expect((await queue()).assignments[0].progress).toBeNull();
    expect(calls("student_progress", "select")).toEqual([]);
  });

  it("keeps the assignments but hides every progress state when the progress read fails", async () => {
    override("student_progress", failed);
    const result = await queue();
    expect(result.assignments.map(row => row.id)).toEqual(["a", "b", "c"]);
    expect(result.assignments.every(row => row.progress === null)).toBe(true);
    expect(result.progressError).toContain("Exploration progress could not be loaded");
  });

  it("treats an unrecognised status as unknown for that assignment only", async () => {
    progress.push({ class_activity_id: "a", status: "future_status" });
    const result = await queue();
    expect(result.assignments.map(row => row.progress)).toEqual([null, "in_progress", "completed"]);
    expect(result.progressError).toBeNull();
  });

  it("requires a session and an active class before reading assignments", async () => {
    mocks.session.mockResolvedValue(null);
    expect(await getStudentWorkQueue()).toEqual({ status: "unauthenticated" });
    expect(mocks.admin).not.toHaveBeenCalled();
    mocks.session.mockResolvedValue({ studentId, classId });
    for (const table of ["students", "classes"]) {
      const read = mocks.read.getMockImplementation()!;
      override(table, { data: null, error: null });
      expect(await getStudentWorkQueue()).toEqual({ status: "unauthenticated" });
      mocks.read.mockImplementation(read);
    }
    expect(calls("class_activities", "select")).toEqual([]);
  });

  it.each(["students", "classes", "class_activities"])("reports a failed %s read as an error", async table => {
    override(table, failed);
    expect(await getStudentWorkQueue()).toEqual(queueError);
  });

  it("sanitizes session/configuration failures rather than returning a false empty queue", async () => {
    mocks.session.mockRejectedValue(new Error("private"));
    expect(await getStudentWorkQueue()).toEqual(queueError);
  });
});
