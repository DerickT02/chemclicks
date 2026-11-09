import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), admin: vi.fn(), read: vi.fn(), rpc: vi.fn(),
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
let states: { assignment_id: string; status: string; stage: string; exploration_completed: boolean; exploration_completed_at: string | null; passing_attempt_number: number | null; passing_score: number | null; passing_total: number | null; passing_percentage: number | null; passing_quiz_key: string | null; passing_completed_at: string | null; failed_quiz_attempt_count: number; completed_at: string | null }[];
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
  states = ["a", "b", "c"].map((assignmentId, index) => ({
    assignment_id: assignmentId,
    status: index === 0 ? "not_started" : index === 1 ? "in_progress" : "completed",
    stage: index === 0 ? "not_started" : index === 1 ? "exploring" : "completed",
    exploration_completed: index === 2,
    exploration_completed_at: null,
    passing_attempt_number: null,
    passing_score: null,
    passing_total: null,
    passing_percentage: null,
    passing_quiz_key: null,
    passing_completed_at: null,
    failed_quiz_attempt_count: 0,
    completed_at: null,
  }));
  mocks.session.mockResolvedValue({ studentId, classId });
  mocks.read.mockImplementation((table: string) => {
    if (table === "students") return { data: { id: studentId, class_id: classId, first_name: "Alex", last_name: "Student", login_id: "private-login" }, error: null };
    if (table === "classes") return { data: { id: classId, name: "Chemistry", section: "A", is_active: true, class_code: "private-code" }, error: null };
    const rows = table === "class_activities" ? assignments : [];
    return { data: structuredClone(rows), error: null };
  });
  mocks.rpc.mockImplementation(async (name: string, args: { p_assignment_ids?: string[] }) => {
    mocks.calls.push({ table: name, method: "rpc", args: [args] });
    return { data: states.filter(row => args.p_assignment_ids?.includes(row.assignment_id)), error: null };
  });
  mocks.admin.mockImplementation(() => ({ rpc: mocks.rpc, from: (table: string) => {
    const builder: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of ["select", "eq", "is", "in", "order", "not"]) {
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
  it("uses the shared assignment state RPC for completion and reads metadata with ownership filters", async () => {
    const result = await queue();
    expect(result.assignments.map(row => row.progress)).toEqual(["not_started", "in_progress", "completed"]);
    expect(result.context).toEqual({ studentName: "Alex Student", className: "Chemistry", section: "A" });
    expect(result.progressError).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/private-login|private-code|student_id|class_id|score|passed/);
    expect(tables()).toEqual(["students", "classes", "class_activities"]);
    // Unassigned (archived) work must not reappear in the student's list.
    expect(calls("class_activities", "is").map(call => call.args)).toEqual([["archived_at", null]]);
    expect(calls("students", "eq").map(call => call.args)).toEqual([["id", studentId], ["class_id", classId]]);
    expect(calls("classes", "eq").map(call => call.args)).toEqual([["id", classId], ["is_active", true]]);
    expect(calls("class_activities", "eq").map(call => call.args)).toEqual([["class_id", classId]]);
    expect(calls("student_assignment_progress_states", "rpc").map(call => call.args)).toEqual([[
      { p_student_id: studentId, p_class_id: classId, p_assignment_ids: ["a", "b", "c"] },
    ]]);
  });

  it("gives future/closed/invalid/unsupported work null progress and only asks for open exercises", async () => {
    assignments = [assignment("open"), assignment("future", { opens_at: "9999-01-01T00:00:00Z" }),
      assignment("closed", { closes_at: "2000-01-01T00:00:00Z" }), assignment("invalid", { closes_at: "bad" }),
      assignment("unsupported", { activity: { id: "future", title: "Future", type: "future_activity" as AssignmentRow["activity"]["type"], order_index: 1 } }),
    ];
    states = [{ ...states[0], assignment_id: "open" }];
    const result = await queue();
    expect(result.assignments.map(row => [row.id, row.progress])).toEqual([
      ["open", "not_started"], ["future", null], ["closed", null], ["invalid", null], ["unsupported", null],
    ]);
    expect(calls("student_assignment_progress_states", "rpc").map(call => call.args)).toEqual([[
      { p_student_id: studentId, p_class_id: classId, p_assignment_ids: ["open"] },
    ]]);
    expect(mocks.calls.filter(call => call.method === "select").some(call => String(call.args[0]).includes("*"))).toBe(false);
  });

  it("skips the progress read when no supported work is open", async () => {
    assignments = [assignment("closed", { closes_at: "2000-01-01T00:00:00Z" })];
    expect((await queue()).assignments[0].progress).toBeNull();
    expect(calls("student_assignment_progress_states", "rpc")).toEqual([]);
  });

  it("keeps the assignments but hides every progress state when the progress read fails", async () => {
    mocks.rpc.mockResolvedValue(failed);
    const result = await queue();
    expect(result.assignments.map(row => row.id)).toEqual(["a", "b", "c"]);
    expect(result.assignments.every(row => row.progress === null)).toBe(true);
    expect(result.progressError).toContain("Assignment progress could not be loaded");
  });

  it("treats an unrecognised status as unknown for that assignment only", async () => {
    states[0].status = "future_status";
    const result = await queue();
    expect(result.assignments.map(row => row.progress)).toEqual([null, "in_progress", "completed"]);
    expect(result.progressError).toBeNull();
  });

  it("never marks a section locked behind an earlier unfinished one", async () => {
    assignments = [
      assignment("a", { activity: { id: "x", title: "First", type: "lewis_diagram", order_index: 1 } }),
      assignment("b", { activity: { id: "y", title: "Second", type: "lewis_structures_covalent", order_index: 2 } }),
    ];
    states = ["a", "b"].map(assignmentId => ({ ...states[0], assignment_id: assignmentId }));
    const result = await queue();
    expect(result.assignments.map(row => row.progress)).toEqual(["not_started", "not_started"]);
    expect(result.assignments.every(row => !("lockedBy" in row))).toBe(true);
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
