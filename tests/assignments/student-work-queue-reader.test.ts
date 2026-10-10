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
type AssignmentRow = StudentAssignment & { class_id: string };
const assignment = (id: string, overrides: Partial<AssignmentRow> = {}): AssignmentRow => ({
  id, class_id: classId, opens_at: null, closes_at: null,
  activity: { id: `activity-${id}`, title: id, type: "lewis_diagram", order_index: 1 }, ...overrides,
});
let assignments: ReturnType<typeof assignment>[];
let progress: { student_id: string; class_activity_id: string; status: string }[];
let cap: number;
const calls = (table: string, method: string) => mocks.calls.filter(call => call.table === table && call.method === method);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  assignments = [assignment("a"), assignment("b"), assignment("c")];
  progress = [
    { student_id: studentId, class_activity_id: "b", status: "in_progress" },
    { student_id: studentId, class_activity_id: "c", status: "completed" },
  ];
  cap = 100;
  mocks.session.mockResolvedValue({ studentId, classId });
  mocks.read.mockImplementation((table: string, range: number[], ids: string[]) => {
    if (table === "students") return { data: { id: studentId, class_id: classId, first_name: "Alex", last_name: "Student", login_id: "private-login" }, error: null };
    if (table === "classes") return { data: { id: classId, name: "Chemistry", section: "A", is_active: true, class_code: "private-code" }, error: null };
    const rows = table === "class_activities" ? assignments : progress.filter(row => ids.includes(row.class_activity_id));
    return { data: rows.slice(range[0], Math.min(range[1] + 1, range[0] + cap)), error: null };
  });
  mocks.admin.mockImplementation(() => ({ from: (table: string) => {
    let range = [0, 99];
    let ids: string[] = [];
    const builder: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of ["select", "eq", "in", "or", "order", "range"]) {
      builder[method] = (...args: unknown[]) => {
        mocks.calls.push({ table, method, args });
        if (method === "range") range = args as number[];
        if (method === "in") ids = args[1] as string[];
        return builder;
      };
    }
    builder.maybeSingle = builder.returns = async () => mocks.read(table, range, ids);
    return builder;
  } }));
});

async function queue() {
  const result = await getStudentWorkQueue();
  if (result.status !== "ok") throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
  return result;
}

describe("authorized student work queue", () => {
  it("uses persisted current exploration state and defaults only a successful missing row to not started", async () => {
    const result = await queue();
    expect(result.assignments.map(row => row.progress)).toEqual(["not_started", "in_progress", "completed"]);
    expect(result.context).toEqual({ studentName: "Alex Student", className: "Chemistry", section: "A" });
    expect(result.progressError).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/private-login|private-code|student_id|class_id|score|passed/);
    expect(calls("students", "eq")).toEqual(expect.arrayContaining([
      expect.objectContaining({ args: ["id", studentId] }), expect.objectContaining({ args: ["class_id", classId] }),
    ]));
    expect(calls("classes", "eq")).toContainEqual(expect.objectContaining({ args: ["is_active", true] }));
    expect(calls("class_activities", "eq").every(call => JSON.stringify(call.args) === JSON.stringify(["class_id", classId]))).toBe(true);
    expect(calls("student_progress", "eq")).toEqual(expect.arrayContaining([
      expect.objectContaining({ args: ["student_id", studentId] }),
      expect.objectContaining({ args: ["student.class_id", classId] }),
      expect.objectContaining({ args: ["assignment.class_id", classId] }),
    ]));
  });

  it("returns only schedule metadata for future/closed/invalid/unsupported work and never reads its progress or exercises", async () => {
    assignments = [assignment("open"), assignment("future", { opens_at: "9999-01-01T00:00:00Z" }),
      assignment("closed", { closes_at: "2000-01-01T00:00:00Z" }), assignment("invalid", { closes_at: "bad" }),
      assignment("unsupported", { activity: { id: "bohr", title: "Bohr", type: "bohr_model_intro", order_index: 1 } }),
      assignment("foreign", { class_id: "other-class" }),
    ];
    const result = await queue();
    expect(result.assignments.map(row => [row.id, row.progress])).toEqual([
      ["open", "not_started"], ["future", null], ["closed", null], ["invalid", null], ["unsupported", null],
    ]);
    expect(calls("student_progress", "in").every(call => JSON.stringify(call.args[1]) === '["open"]')).toBe(true);
    expect(calls("student_progress", "or")).toEqual(expect.arrayContaining([
      expect.objectContaining({ args: [expect.stringMatching(/^opens_at\.is\.null,opens_at\.lte\./), { referencedTable: "assignment" }] }),
      expect.objectContaining({ args: [expect.stringMatching(/^closes_at\.is\.null,closes_at\.gt\./), { referencedTable: "assignment" }] }),
    ]));
    expect(mocks.calls.map(call => call.table)).not.toContain("student_attempts");
    expect(mocks.calls.filter(call => call.method === "select").some(call => String(call.args[0]).includes("*"))).toBe(false);
  });

  it("skips progress reads completely when no supported work is open", async () => {
    assignments = [assignment("closed", { closes_at: "2000-01-01T00:00:00Z" })];
    expect((await queue()).assignments[0].progress).toBeNull();
    expect(calls("student_progress", "select")).toEqual([]);
  });

  it("requires a session and an active, matching student/class before metadata reads", async () => {
    mocks.session.mockResolvedValue(null);
    expect(await getStudentWorkQueue()).toEqual({ status: "unauthenticated" });
    expect(mocks.admin).not.toHaveBeenCalled();
    mocks.session.mockResolvedValue({ studentId, classId });
    const read = mocks.read.getMockImplementation()!;
    for (const [table, data] of [
      ["students", null], ["students", { id: "foreign", class_id: classId }],
      ["students", { id: studentId, class_id: "other" }], ["classes", null],
      ["classes", { id: classId, is_active: false }], ["classes", { id: "other", is_active: true }],
    ] as const) {
      mocks.read.mockImplementation((t, range, ids) => t === table ? { data, error: null } : read(t, range, ids));
      expect(await getStudentWorkQueue()).toEqual({ status: "unauthenticated" });
    }
    expect(calls("class_activities", "select")).toEqual([]);
  });

  it("rechecks membership and class disabling after reads", async () => {
    const read = mocks.read.getMockImplementation()!;
    let classReads = 0;
    mocks.read.mockImplementation((table, range, ids) => table === "classes" && ++classReads > 1
      ? { data: null, error: null } : read(table, range, ids));
    expect(await getStudentWorkQueue()).toEqual({ status: "unauthenticated" });
  });

  it("reads >1,000 assignments and progress records with a smaller backend cap and bounded ID batches", async () => {
    cap = 7;
    assignments = Array.from({ length: 1005 }, (_, index) => assignment(`a-${index}`));
    progress = assignments.map(row => ({ student_id: studentId, class_activity_id: row.id, status: "completed" }));
    const result = await queue();
    expect(result.assignments).toHaveLength(1005);
    expect(result.assignments.every(row => row.progress === "completed")).toBe(true);
    expect(calls("student_progress", "in").every(call => (call.args[1] as string[]).length <= 50)).toBe(true);
    expect(calls("class_activities", "range")).toContainEqual(expect.objectContaining({ args: [1001, 1100] }));
  });

  it.each(["error", "null", "throw"])("rejects partial metadata on a later-page %s", async (failure) => {
    cap = 1;
    const read = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((table, range, ids) => {
      if (table === "class_activities" && range[0] === 1) {
        if (failure === "throw") throw new Error("private");
        return { data: null, error: failure === "error" ? { message: "private" } : null };
      }
      return read(table, range, ids);
    });
    expect(await getStudentWorkQueue()).toEqual({ status: "error", message: "Your assignments could not be loaded. Please try again." });
    expect(calls("student_progress", "select")).toEqual([]);
  });

  it.each(["error", "null", "throw"])("preserves schedules but hides every progress state after a later-page %s", async (failure) => {
    cap = 1;
    const read = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((table, range, ids) => {
      if (table === "student_progress" && range[0] === 1) {
        if (failure === "throw") throw new Error("private");
        return { data: null, error: failure === "error" ? { message: "private" } : null };
      }
      return read(table, range, ids);
    });
    const result = await queue();
    expect(result.assignments.map(row => row.progress)).toEqual([null, null, null]);
    expect(result.progressError).toContain("Exploration progress could not be loaded");
  });

  it("discards earlier batches if a later progress batch fails", async () => {
    assignments = Array.from({ length: 51 }, (_, index) => assignment(`a-${index}`));
    const read = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((table, range, ids) => table === "student_progress" && ids.includes("a-50")
      ? { data: null, error: { message: "private" } } : read(table, range, ids));
    const result = await queue();
    expect(result.assignments.every(row => row.progress === null)).toBe(true);
    expect(result.progressError).not.toBeNull();
  });

  it("ignores foreign-student progress and tolerates identical duplicates", async () => {
    progress.push({ student_id: "foreign", class_activity_id: "a", status: "completed" }, { ...progress[1] });
    const result = await queue();
    expect(result.assignments.map(row => row.progress)).toEqual(["not_started", "in_progress", "completed"]);
  });

  it.each(["future_status", "in_progress"])("rejects invalid or conflicting progress (%s)", async (status) => {
    progress.push({ student_id: studentId, class_activity_id: "c", status });
    const result = await queue();
    expect(result.progressError).not.toBeNull();
    expect(result.assignments.every(row => row.progress === null)).toBe(true);
  });

  it("returns fresh progress on each call, including a retry moving completed to in progress", async () => {
    expect((await queue()).assignments[2].progress).toBe("completed");
    progress[1].status = "in_progress";
    expect((await queue()).assignments[2].progress).toBe("in_progress");
  });

  it("drops saved status if a schedule changes during the read, without inventing not-started status", async () => {
    const read = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((table, range, ids) => {
      if (table === "student_progress") assignments[2].closes_at = "9999-01-01T00:00:00Z";
      return read(table, range, ids);
    });
    // Clone API rows so the mock behaves like independent network responses.
    const current = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((...args) => structuredClone(current(...args)));
    const result = await queue();
    expect(result.assignments[2].progress).toBeNull();
    expect(result.assignments[2].closes_at).toBe("9999-01-01T00:00:00Z");
  });

  it("sanitizes session/configuration failures rather than returning a false empty queue", async () => {
    mocks.session.mockRejectedValue(new Error("private"));
    expect(await getStudentWorkQueue()).toEqual({ status: "error", message: "Your assignments could not be loaded. Please try again." });
  });
});
