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

import { submitStudentQuiz } from "@/lib/server/student-quizzes";

const assignmentId = "11111111-1111-1111-1111-111111111111";
const submissionKey = "submission-1";
const answers = [
  { questionId: "bohr-q-1", selectedIndex: 0 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ studentId: "student", classId: "class" });
});

describe("student quiz submission server boundary", () => {
  it("uses session identity and sends answers only to the grading RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ id: "attempt" }], error: null });

    await expect(submitStudentQuiz({
      assignmentId,
      quizKey: "bohr_models",
      submissionKey,
      answers,
    })).resolves.toEqual({ id: "attempt" });

    expect(mocks.rpc).toHaveBeenCalledWith("student_quiz_submit", {
      p_student_id: "student",
      p_class_id: "class",
      p_assignment_id: assignmentId,
      p_quiz_key: "bohr_models",
      p_submission_key: submissionKey,
      p_answers: answers,
    });
  });

  it("does not access the database without a student session", async () => {
    mocks.session.mockResolvedValue(null);

    await expect(submitStudentQuiz({
      assignmentId,
      quizKey: "bohr_models",
      submissionKey,
      answers,
    })).rejects.toThrow("session");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed input before invoking the database", async () => {
    await expect(submitStudentQuiz({
      assignmentId: "not-an-assignment",
      quizKey: "bohr_models",
      submissionKey,
      answers,
    })).rejects.toThrow("Invalid quiz submission");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not claim success when the grading RPC fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });

    await expect(submitStudentQuiz({
      assignmentId,
      quizKey: "bohr_models",
      submissionKey,
      answers,
    })).rejects.toThrow("could not be submitted");
  });
});
