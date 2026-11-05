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
const completedRow = {
  id: "result-1",
  attempt_number: 2,
  score: 4,
  question_total: 5,
  passed: true,
  status: "completed",
};
const startData = (overrides: Record<string, unknown> = {}) => ({
  attempt_id: attemptId,
  attempt_number: 1,
  mode: "ruler_tenths",
  questions: [
    { question_index: 0, reading: 1.4, first_answer: "1.3", is_correct: true },
    { question_index: 1, reading: 2.8, first_answer: null, is_correct: null },
  ],
  ...overrides,
});

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
        mode: "ruler_tenths",
        questions: [{ question_index: 0, reading: 1.4 }],
      },
      error: null,
    });

    await expect(startStudentMeasurementQuiz(assignmentId, "ruler_tenths")).resolves.toEqual({
      attemptId,
      attemptNumber: 1,
      questions: [{ questionIndex: 0, reading: 1.4, firstAnswer: null, isCorrect: null }],
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
    const attempt = completedRow;
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

describe("student measurement quiz server boundary failures", () => {
  it("passes saved answers through when start resumes an unfinished attempt", async () => {
    mocks.rpc.mockResolvedValue({ data: startData(), error: null });

    await expect(startStudentMeasurementQuiz(assignmentId, "ruler_tenths")).resolves.toEqual({
      attemptId,
      attemptNumber: 1,
      questions: [
        { questionIndex: 0, reading: 1.4, firstAnswer: "1.3", isCorrect: true },
        { questionIndex: 1, reading: 2.8, firstAnswer: null, isCorrect: null },
      ],
    });
  });

  it.each([
    ["a different mode", { mode: "cylinder_tenths" }],
    ["no mode", { mode: undefined }],
    ["no attempt id", { attempt_id: undefined }],
    ["a fractional attempt number", { attempt_number: 1.5 }],
    ["a zero attempt number", { attempt_number: 0 }],
    ["no questions", { questions: [] }],
    ["questions that aren't a list", { questions: "none" }],
    ["a missing question", { questions: [{ question_index: 1, reading: 2.8 }] }],
    ["a question with no reading", { questions: [{ question_index: 0 }] }],
    ["a non-numeric reading", { questions: [{ question_index: 0, reading: "1.4" }] }],
    ["a saved answer that isn't text", {
      questions: [{ question_index: 0, reading: 1.4, first_answer: 1.4, is_correct: true }],
    }],
    ["a saved grade that isn't a boolean", {
      questions: [{ question_index: 0, reading: 1.4, first_answer: "1.4", is_correct: "yes" }],
    }],
    ["a grade without a saved answer", {
      questions: [{ question_index: 0, reading: 1.4, first_answer: null, is_correct: true }],
    }],
  ])("rejects a started attempt with %s", async (_label, overrides) => {
    mocks.rpc.mockResolvedValue({ data: startData(overrides), error: null });
    await expect(startStudentMeasurementQuiz(assignmentId, "ruler_tenths")).rejects.toThrow();
  });

  it.each([
    ["an RPC error", () => mocks.rpc.mockResolvedValue({ data: null, error: { message: "denied" } })],
    ["a rejected request", () => mocks.rpc.mockRejectedValue(new TypeError("fetch failed"))],
  ])("fails a start on %s", async (_label, arrange) => {
    arrange();
    await expect(startStudentMeasurementQuiz(assignmentId, "ruler_tenths")).rejects.toThrow();
  });

  it.each([
    ["record", () => recordStudentMeasurementAnswer(assignmentId, attemptId, 0, "1.4")],
    ["complete", () => completeStudentMeasurementQuiz(assignmentId, attemptId)],
  ])("does not %s without an authenticated student", async (_stage, call) => {
    mocks.session.mockResolvedValue(null);
    await expect(call()).rejects.toThrow("student session");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["an attempt id that isn't a UUID", () => recordStudentMeasurementAnswer(assignmentId, "attempt-1", 0, "1.4")],
    ["a negative question", () => recordStudentMeasurementAnswer(assignmentId, attemptId, -1, "1.4")],
    ["a fractional question", () => recordStudentMeasurementAnswer(assignmentId, attemptId, 0.5, "1.4")],
    ["an overlong answer", () => recordStudentMeasurementAnswer(assignmentId, attemptId, 0, "1".repeat(65))],
    ["a completion with a bad attempt id", () => completeStudentMeasurementQuiz(assignmentId, "attempt-1")],
  ])("rejects %s before calling the database", async (_label, call) => {
    await expect(call()).rejects.toThrow("Invalid measurement quiz");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["an RPC error", { data: null, error: { message: "Measurement attempt unavailable" } }],
    ["no data", { data: null, error: null }],
    ["a missing counted flag", { data: { first_try_correct: true, mode: "ruler_tenths", reading: 1.4 }, error: null }],
    ["a non-boolean grade", { data: { counted: true, first_try_correct: "yes", mode: "ruler_tenths", reading: 1.4 }, error: null }],
    ["an unknown mode", { data: { counted: true, first_try_correct: true, mode: "bohr_models", reading: 1.4 }, error: null }],
    ["a missing reading", { data: { counted: true, first_try_correct: true, mode: "ruler_tenths" }, error: null }],
    ["a counted answer with no grade", { data: { counted: true, first_try_correct: null, mode: "ruler_tenths", reading: 1.4 }, error: null }],
  ])("does not save an answer on %s", async (_label, response) => {
    mocks.rpc.mockResolvedValue(response);
    await expect(recordStudentMeasurementAnswer(assignmentId, attemptId, 0, "1.4"))
      .rejects.toThrow("Your answer could not be saved");
  });

  it("does not save an answer when the request itself is rejected", async () => {
    mocks.rpc.mockRejectedValue(new TypeError("fetch failed"));
    await expect(recordStudentMeasurementAnswer(assignmentId, attemptId, 0, "1.4")).rejects.toThrow();
  });

  it.each([
    [false, "incorrect"],
    [true, "correct"],
  ] as const)("reports a replayed answer by its saved grade (%s), not the resubmitted text", async (saved, status) => {
    // The resubmitted 1.4 would be correct, and 9.9 would not; only the saved grade counts.
    mocks.rpc.mockResolvedValue({
      data: { counted: false, first_try_correct: saved, mode: "ruler_tenths", reading: 1.4 },
      error: null,
    });

    const receipt = await recordStudentMeasurementAnswer(assignmentId, attemptId, 0, saved ? "9.9" : "1.4");
    expect(receipt).toMatchObject({ counted: false, firstTryCorrect: saved, result: { status } });
    expect(receipt.result.message).toContain("Your first answer was already saved");
  });

  it("keeps an ungraded resubmission fixable", async () => {
    mocks.rpc.mockResolvedValue({
      data: { counted: false, first_try_correct: null, mode: "ruler_tenths", reading: 1.4 },
      error: null,
    });

    const receipt = await recordStudentMeasurementAnswer(assignmentId, attemptId, 0, "abc");
    expect(receipt).toMatchObject({ counted: false, firstTryCorrect: null, result: { status: "invalid" } });
  });

  it.each([
    ["an RPC error", { data: null, error: { message: "Measurement attempt unavailable" } }],
    ["no rows", { data: [], error: null }],
    ["two rows", { data: [completedRow, completedRow], error: null }],
    ["a row that isn't an object", { data: ["result-1"], error: null }],
    ["a missing id", { data: [{ ...completedRow, id: undefined }], error: null }],
    ["a missing attempt number", { data: [{ ...completedRow, attempt_number: null }], error: null }],
    ["a missing score", { data: [{ ...completedRow, score: null }], error: null }],
    ["a missing total", { data: [{ ...completedRow, question_total: null }], error: null }],
    ["a zero total", { data: [{ ...completedRow, score: 0, question_total: 0 }], error: null }],
    ["a score above the total", { data: [{ ...completedRow, score: 6 }], error: null }],
    ["a missing pass flag", { data: [{ ...completedRow, passed: null }], error: null }],
    ["an unfinished status", { data: [{ ...completedRow, status: "in_progress" }], error: null }],
  ])("does not turn %s into a completed attempt", async (_label, response) => {
    mocks.rpc.mockResolvedValue(response);
    await expect(completeStudentMeasurementQuiz(assignmentId, attemptId))
      .rejects.toThrow("The measurement quiz could not be completed");
  });

  it("does not complete when the request itself is rejected", async () => {
    mocks.rpc.mockRejectedValue(new TypeError("fetch failed"));
    await expect(completeStudentMeasurementQuiz(assignmentId, attemptId)).rejects.toThrow();
  });
});
