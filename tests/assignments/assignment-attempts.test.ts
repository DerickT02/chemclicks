import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  reader: vi.fn(),
  results: {} as Record<string, unknown>,
  calls: [] as { table: string; method: string; args: unknown[] }[],
}));
vi.mock("@/lib/auth/student-session", () => ({ getStudentSession: mocks.session }));
vi.mock("@/lib/db/student-assignments", () => ({ getStudentAssignments: mocks.reader }));
vi.mock("@/lib/server/database", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const builder: Record<string, (...args: unknown[]) => unknown> = {};
      for (const method of ["select", "eq", "is"]) {
        builder[method] = (...args: unknown[]) => {
          mocks.calls.push({ table, method, args });
          return builder;
        };
      }
      builder.maybeSingle = async () => mocks.results[table];
      builder.order = async () => mocks.results[table];
      return builder;
    },
  }),
}));

import { getAssignmentAttempts } from "@/lib/server/student-assignments";

const studentId = "11111111-1111-4111-8111-111111111111";
const classId = "22222222-2222-4222-8222-222222222222";
const bohr = {
  id: "33333333-3333-4333-8333-333333333333", opens_at: null, closes_at: null,
  activity: { id: "activity-bohr", title: "Bohr Model Stability", type: "bohr_model_stability", order_index: 2 },
};
const exploration = { id: "attempt-1", attempt_number: 1, quiz_key: null, status: "completed", passed: null };
const callsTo = (table: string, method: string) =>
  mocks.calls.filter((call) => call.table === table && call.method === method);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  mocks.session.mockResolvedValue({ studentId, classId });
  mocks.reader.mockResolvedValue({ status: "ok", assignments: [bohr] });
  mocks.results.student_progress = { data: { id: "progress-1" }, error: null };
  mocks.results.student_attempts = { data: [exploration], error: null };
});

describe("getAssignmentAttempts", () => {
  it("reads only exploration attempts, never the quiz attempts sharing the progress row", async () => {
    expect(await getAssignmentAttempts(bohr.id)).toEqual([exploration]);
    expect(callsTo("student_progress", "eq")).toEqual([
      expect.objectContaining({ args: ["student_id", studentId] }),
      expect.objectContaining({ args: ["class_activity_id", bohr.id] }),
    ]);
    expect(callsTo("student_attempts", "eq")).toEqual([
      expect.objectContaining({ args: ["progress_id", "progress-1"] }),
    ]);
    expect(callsTo("student_attempts", "is")).toEqual([
      expect.objectContaining({ args: ["quiz_key", null] }),
    ]);
  });

  it("refuses assignments outside the student's authorized list before reading attempts", async () => {
    mocks.reader.mockResolvedValue({ status: "ok", assignments: [] });
    await expect(getAssignmentAttempts(bohr.id)).rejects.toThrow("Assignment unavailable");
    mocks.reader.mockResolvedValue({ status: "unauthenticated" });
    await expect(getAssignmentAttempts(bohr.id)).rejects.toThrow("Assignment unavailable");
    expect(mocks.calls).toEqual([]);
  });

  it("rejects a missing session", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(getAssignmentAttempts(bohr.id)).rejects.toThrow("sign in");
    expect(mocks.calls).toEqual([]);
  });
});
