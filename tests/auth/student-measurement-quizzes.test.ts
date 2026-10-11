import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/student-session", () => ({ getStudentSession: mocks.session }));
vi.mock("@/lib/server/database", () => ({
  createServiceClient: () => ({ rpc: mocks.rpc }),
}));

import {
  completeStudentMeasurementQuiz,
  recordStudentMeasurementAnswer,
  startStudentMeasurementQuiz,
} from "@/lib/server/student-measurement-quizzes";

const assignmentId = "11111111-1111-1111-1111-111111111111";
const attemptId = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ studentId: "student-1", classId: "class-1" });
});

describe("student measurement quiz server boundary", () => {
  it("starts only the authenticated student's assigned mode and uses server questions", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        attempt_id: attemptId,
        attempt_number: 1,
        questions: [{ question_index: 0, reading: 1.4 }],
      },
      error: null,
    });

    await expect(startStudentMeasurementQuiz(assignmentId, "ruler_tenths")).resolves.toEqual({
      attemptId,
      attemptNumber: 1,
      questions: [{ questionIndex: 0, reading: 1.4 }],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("student_measurement_quiz_start", {
      p_student_id: "student-1",
      p_class_id: "class-1",
      p_assignment_id: assignmentId,
      p_mode: "ruler_tenths",
    });
  });

  it("rejects unsupported modes before calling the database", async () => {
    await expect(startStudentMeasurementQuiz(assignmentId, "bohr_models"))
      .rejects.toThrow("Invalid measurement quiz request");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("asks the server to record each answer and derives feedback from its reading", async () => {
    mocks.rpc.mockResolvedValue({
      data: { counted: true, first_try_correct: true, mode: "ruler_tenths", reading: 1.4 },
      error: null,
    });

    const receipt = await recordStudentMeasurementAnswer(assignmentId, attemptId, 0, "1.4");
    expect(receipt).toMatchObject({
      counted: true,
      firstTryCorrect: true,
      result: { status: "correct" },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("student_measurement_quiz_record_answer", {
      p_student_id: "student-1",
      p_class_id: "class-1",
      p_assignment_id: assignmentId,
      p_attempt_id: attemptId,
      p_question_index: 0,
      p_answer: "1.4",
    });
  });

  it("does not contact the database without an authenticated student", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(startStudentMeasurementQuiz(assignmentId, "ruler_tenths"))
      .rejects.toThrow("student session");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns the persisted result produced by the idempotent completion RPC", async () => {
    const attempt = { id: "result-1", attempt_number: 2, score: 4, question_total: 5, passed: true };
    mocks.rpc.mockResolvedValue({ data: [attempt], error: null });
    await expect(completeStudentMeasurementQuiz(assignmentId, attemptId)).resolves.toEqual(attempt);
    expect(mocks.rpc).toHaveBeenCalledWith("student_measurement_quiz_complete", {
      p_student_id: "student-1",
      p_class_id: "class-1",
      p_assignment_id: assignmentId,
      p_attempt_id: attemptId,
    });
  });
});
