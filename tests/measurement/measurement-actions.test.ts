import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  progression: vi.fn(),
  revalidatePath: vi.fn(),
  start: vi.fn(),
  record: vi.fn(),
  complete: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/assignments/prerequisites", () => ({
  getQuizProgression: mocks.progression,
}));
vi.mock("@/lib/server/student-measurement-quizzes", () => ({
  startStudentMeasurementQuiz: mocks.start,
  recordStudentMeasurementAnswer: mocks.record,
  completeStudentMeasurementQuiz: mocks.complete,
}));

import {
  completeMeasurementQuizAction,
  recordMeasurementAnswerAction,
  startMeasurementQuizAction,
} from "@/app/(student)/student/assignments/[assignmentId]/measurement-actions";

const assignmentId = "11111111-1111-1111-1111-111111111111";
const attemptId = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.progression.mockResolvedValue({ passed: true, nextDestination: "/student/assignments/next" });
});

describe("measurement quiz server actions", () => {
  it("passes a failed start straight back to the student", async () => {
    mocks.start.mockRejectedValue(new Error("The measurement quiz could not be started."));

    await expect(startMeasurementQuizAction(assignmentId, "cylinder_whole"))
      .rejects.toThrow("could not be started");
    expect(mocks.start).toHaveBeenCalledWith(assignmentId, "cylinder_whole");
  });

  it("passes a failed answer save straight back to the student", async () => {
    mocks.record.mockRejectedValue(new Error("Your answer could not be saved. Please try again."));

    await expect(recordMeasurementAnswerAction(assignmentId, attemptId, 2, "4.3"))
      .rejects.toThrow("Your answer could not be saved");
    expect(mocks.record).toHaveBeenCalledWith(assignmentId, attemptId, 2, "4.3");
  });

  it("reports a failed completion without refreshing the page or unlocking the next section", async () => {
    mocks.complete.mockRejectedValue(new Error("The measurement quiz could not be completed."));

    await expect(completeMeasurementQuizAction(assignmentId, attemptId))
      .rejects.toThrow("could not be completed");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.progression).not.toHaveBeenCalled();
  });

  it("returns the saved result, unchanged, each time a completion is replayed", async () => {
    mocks.complete.mockResolvedValue({
      id: "result-1",
      attempt_number: 3,
      quiz_key: "measurement_ruler_hundredths",
      score: 3,
      question_total: 5,
      passed: false,
      status: "completed",
      completed_at: "2026-11-04T13:00:00Z",
    });

    const first = await completeMeasurementQuizAction(assignmentId, attemptId);
    const replay = await completeMeasurementQuizAction(assignmentId, attemptId);
    expect(first).toEqual({
      attemptId: "result-1",
      attemptNumber: 3,
      score: 3,
      total: 5,
      passed: false,
      completedAt: "2026-11-04T13:00:00Z",
      nextDestination: null,
    });
    expect(replay).toEqual(first);
    expect(mocks.progression).not.toHaveBeenCalled();
  });
});
