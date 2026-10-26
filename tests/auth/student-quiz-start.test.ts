import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/auth/student-session", () => ({
  getStudentSession: mocks.session,
}));
vi.mock("@/lib/server/database", () => ({
  createServiceClient: () => ({ rpc: mocks.rpc }),
}));

import { startStudentQuiz } from "@/lib/server/student-quiz-start";

const assignmentId = "11111111-1111-4111-8111-111111111111";
const started = {
  progress_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  status: "in_progress",
  started_at: "2026-10-24T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ studentId: "student-session", classId: "class-session" });
  mocks.rpc.mockResolvedValue({ data: started, error: null });
});

describe("assignment quiz start boundary", () => {
  it("starts only for the student and class from the signed session", async () => {
    await expect(startStudentQuiz(assignmentId, "bohr_models")).resolves.toEqual(started);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("student_quiz_start", {
      p_student_id: "student-session",
      p_class_id: "class-session",
      p_assignment_id: assignmentId,
      p_quiz_key: "bohr_models",
    });
  });

  it("uses a separate RPC only for an explicit boolean retry", async () => {
    await startStudentQuiz(assignmentId, "bohr_models", true);
    await startStudentQuiz(assignmentId, "bohr_models", "true" as unknown as boolean);

    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      "student_quiz_retry_start",
      "student_quiz_start",
    ]);
  });

  it("returns a retry prompt without trusting extra RPC fields", async () => {
    mocks.rpc.mockResolvedValue({
      data: { status: "retry_required", progress_id: "attacker-controlled" },
      error: null,
    });

    await expect(startStudentQuiz(assignmentId, "bohr_models")).resolves.toEqual({
      status: "retry_required",
    });
  });

  it.each([
    ["malformed assignment ID", "not-a-uuid", "bohr_models"],
    ["malformed quiz key", assignmentId, "bohr/models"],
    ["empty quiz key", assignmentId, ""],
  ])("rejects %s before any RPC", async (_case, id, key) => {
    await expect(startStudentQuiz(id, key)).rejects.toThrow("Invalid quiz start");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not call the privileged RPC after the student session expires", async () => {
    mocks.session.mockResolvedValue(null);

    await expect(startStudentQuiz(assignmentId, "bohr_models")).rejects.toThrow("student session");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: { code: "42501" } },
    { data: [], error: null },
    { data: { status: "in_progress", progress_id: "not-a-uuid", started_at: started.started_at }, error: null },
    { data: { status: "in_progress", progress_id: started.progress_id, started_at: "bad" }, error: null },
    { data: { status: "completed", progress_id: "p", started_at: "now" }, error: null },
  ])("fails closed on an RPC error or malformed response: %j", async (response) => {
    mocks.rpc.mockResolvedValue(response);

    await expect(startStudentQuiz(assignmentId, "bohr_models")).rejects.toThrow("could not be started");
  });
});
