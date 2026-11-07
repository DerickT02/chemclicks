import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  schedules: vi.fn(),
  admin: vi.fn(),
  rpc: vi.fn(),
  read: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/student-session", () => ({ getStudentSession: mocks.session }));
vi.mock("@/lib/db/student-assignments", () => ({ getStudentAssignmentSchedules: mocks.schedules }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));

import { getQuizProgression } from "@/lib/assignments/prerequisites";

const studentId = "11111111-1111-4111-8111-111111111111";
const classId = "22222222-2222-4222-8222-222222222222";
const assignmentId = "33333333-3333-4333-8333-333333333333";
const nextId = "44444444-4444-4444-8444-444444444444";
const assignment = (id: string, type: string, order_index: number) => ({
  id,
  opens_at: null,
  closes_at: null,
  activity: { id: `activity-${id}`, title: id, type, order_index },
});

let state: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ studentId, classId });
  mocks.schedules.mockResolvedValue({
    status: "ok",
    assignments: [
      assignment(assignmentId, "lewis_structures_covalent", 1),
      assignment(nextId, "lewis_diagram", 2),
    ],
  });
  state = {
    assignment_id: assignmentId,
    status: "in_progress",
    stage: "exploring",
    exploration_completed: false,
    exploration_completed_at: null,
    passing_attempt_number: 1,
    passing_score: 10,
    passing_total: 10,
    passing_percentage: 100,
    passing_quiz_key: "lewis_covalent",
    passing_completed_at: "2026-11-06T12:00:00Z",
    failed_quiz_attempt_count: 0,
    completed_at: null,
  };
  mocks.rpc.mockImplementation(async (_name: string, args: { p_assignment_ids: string[] }) => ({
    data: args.p_assignment_ids.flatMap((id) => id === assignmentId
      ? [structuredClone(state)]
      : [{
        assignment_id: id,
        status: "not_started",
        stage: "not_started",
        exploration_completed: false,
        exploration_completed_at: null,
        passing_attempt_number: null,
        passing_score: null,
        passing_total: null,
        passing_percentage: null,
        passing_quiz_key: null,
        passing_completed_at: null,
        failed_quiz_attempt_count: 0,
        completed_at: null,
      }]),
    error: null,
  }));
  mocks.read.mockImplementation((table: string) => table === "student_progress"
    ? { data: { id: "progress", class_activity_id: assignmentId, status: "in_progress" }, error: null }
    : { data: { id: "passing-attempt" }, error: null });
  mocks.admin.mockReturnValue({
    rpc: mocks.rpc,
    from: (table: string) => {
      const builder: Record<string, (...args: unknown[]) => unknown> = {};
      for (const method of ["select", "eq", "limit", "in", "not"]) builder[method] = () => builder;
      builder.maybeSingle = async () => mocks.read(table);
      builder.returns = async () => ({
        data: table === "student_progress"
          ? [{ id: "progress", class_activity_id: assignmentId, status: "in_progress" }]
          : [{ progress_id: "progress", quiz_key: "lewis_covalent" }],
        error: null,
      });
      return builder;
    },
  });
});

describe("quiz progression from shared assignment state", () => {
  it("keeps a quiz-only pass visible without offering next-section continuation", async () => {
    await expect(getQuizProgression(assignmentId, "lewis_covalent")).resolves.toEqual({
      passed: true,
      assignmentCompleted: false,
      nextDestination: null,
    });
  });

  it("offers continuation only after the shared state is complete", async () => {
    state.status = "completed";
    state.stage = "completed";
    state.exploration_completed = true;
    state.exploration_completed_at = "2026-11-06T12:05:00Z";
    state.completed_at = "2026-11-06T12:05:00Z";

    await expect(getQuizProgression(assignmentId, "lewis_covalent")).resolves.toEqual({
      passed: true,
      assignmentCompleted: true,
      nextDestination: `/student/assignments/${nextId}`,
    });
  });
});
