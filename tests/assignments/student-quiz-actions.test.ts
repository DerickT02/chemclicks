import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  progression: vi.fn(),
  completeMeasurement: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/server/student-quizzes", () => ({ submitStudentQuiz: mocks.submit }));
vi.mock("@/lib/assignments/prerequisites", () => ({ getQuizProgression: mocks.progression }));
vi.mock("@/lib/server/student-measurement-quizzes", () => ({
  completeStudentMeasurementQuiz: mocks.completeMeasurement,
  recordStudentMeasurementAnswer: vi.fn(),
  startStudentMeasurementQuiz: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("server-only", () => ({}));

import { submitQuizAction } from "@/app/(student)/student/quizzes/actions";
import { completeMeasurementQuizAction } from "@/app/(student)/student/assignments/[assignmentId]/measurement-actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("student quiz completion actions", () => {
  it("returns the shared assignment state after a standard quiz passes", async () => {
    mocks.submit.mockResolvedValue({
      id: "attempt-1", attempt_number: 1, score: 4, question_total: 5,
      percentage: 80, passed: true,
    });
    mocks.progression.mockResolvedValue({
      passed: true, assignmentCompleted: false, nextDestination: null,
    });

    const result = await submitQuizAction({
      assignmentId: "assignment-1", quizKey: "lewis_covalent", startedAt: "2026-11-06T12:00:00Z",
      submissionKey: "submission-1", answers: [],
    });

    expect(mocks.progression).toHaveBeenCalledWith("assignment-1", "lewis_covalent");
    expect(result).toMatchObject({ passed: true, assignmentCompleted: false, nextDestination: null });
  });

  it("preserves completed state after a failed retry without returning continuation", async () => {
    mocks.submit.mockResolvedValue({
      id: "attempt-2", attempt_number: 2, score: 2, question_total: 5,
      percentage: 40, passed: false,
    });
    mocks.progression.mockResolvedValue({
      passed: true, assignmentCompleted: true, nextDestination: "/student/assignments/next",
    });

    const result = await submitQuizAction({
      assignmentId: "assignment-1", quizKey: "lewis_covalent", startedAt: "2026-11-06T12:00:00Z",
      submissionKey: "submission-2", answers: [],
    });

    expect(mocks.progression).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ passed: false, assignmentCompleted: true, nextDestination: null });
  });

  it("returns measurement pass and assignment completion independently", async () => {
    mocks.completeMeasurement.mockResolvedValue({
      id: "measurement-attempt-1", attempt_number: 1, score: 5, question_total: 5,
      passed: true, quiz_key: "measurement_ruler_tenths", completed_at: "2026-11-06T12:05:00Z",
    });
    mocks.progression.mockResolvedValue({
      passed: true, assignmentCompleted: false, nextDestination: null,
    });

    const result = await completeMeasurementQuizAction("assignment-1", "measurement-attempt-1");

    expect(mocks.progression).toHaveBeenCalledWith("assignment-1", "measurement_ruler_tenths");
    expect(result).toMatchObject({ passed: true, assignmentCompleted: false, nextDestination: null });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/student/assignments/assignment-1");
  });
});
