// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actions = vi.hoisted(() => ({
  start: vi.fn(),
  record: vi.fn(),
  complete: vi.fn(),
}));

vi.mock("@/app/(student)/student/assignments/[assignmentId]/measurement-actions", () => ({
  startMeasurementQuizAction: actions.start,
  recordMeasurementAnswerAction: actions.record,
  completeMeasurementQuizAction: actions.complete,
}));

import MeasurementQuiz from "@/components/measurement/MeasurementQuiz";

const readings = [1.4, 2.8, 3.7, 4.3, 5.9];
const attempt = (attemptNumber: number, attemptId: string) => ({
  attemptId,
  attemptNumber,
  questions: readings.map((reading, questionIndex) => ({ questionIndex, reading })),
});

beforeEach(() => {
  vi.clearAllMocks();
  actions.start.mockResolvedValue(attempt(1, "attempt-1"));
  let responseIndex = 0;
  actions.record.mockImplementation(async () => {
    const correct = responseIndex !== 0;
    responseIndex += 1;
    return {
      counted: true,
      firstTryCorrect: correct,
      result: correct
        ? { status: "correct", message: "Correct reading." }
        : { status: "incorrect", reason: "value", message: "Try again." },
    };
  });
  actions.complete.mockResolvedValue({
    attemptId: "attempt-1",
    attemptNumber: 1,
    score: 4,
    total: 5,
    passed: true,
    completedAt: "2026-10-09T12:00:00Z",
  });
});

afterEach(cleanup);

describe("assigned measurement quiz", () => {
  it("uses server readings, records first answers, and displays the persisted result", async () => {
    const user = userEvent.setup();
    render(<MeasurementQuiz assignmentId="assignment-1" mode="ruler_tenths" />);

    await user.click(screen.getByRole("button", { name: "Start quiz" }));
    await screen.findByRole("heading", { name: "Ruler question 1 of 5" });
    expect(actions.start).toHaveBeenCalledWith("assignment-1", "ruler_tenths");

    for (let index = 0; index < readings.length; index += 1) {
      const input = screen.getByLabelText("Your reading, in centimeters");
      await user.clear(input);
      await user.type(input, index === 0 ? "0.0" : readings[index].toFixed(1));
      await user.click(screen.getByRole("button", { name: "Check answer" }));
      await screen.findByText(index === 0 ? "Try again." : "Correct reading.");
      expect(actions.record).toHaveBeenLastCalledWith(
        "assignment-1",
        "attempt-1",
        index,
        index === 0 ? "0.0" : readings[index].toFixed(1),
      );
      await user.click(screen.getByRole("button", {
        name: index === readings.length - 1
          ? (index === 0 ? "Skip and see results" : "See results")
          : (index === 0 ? "Skip to next question" : "Next question"),
      }));
    }

    expect(actions.complete).toHaveBeenCalledWith("assignment-1", "attempt-1");
    expect(await screen.findByRole("heading", { name: "Ruler results: 4 of 5 correct" })).toBeTruthy();
    expect(screen.getByText("Passed", { exact: false })).toBeTruthy();
    expect(screen.getByText("Attempt 1")).toBeTruthy();
  });

  it("retries through a new server attempt and keeps the assigned instrument fixed", async () => {
    const user = userEvent.setup();
    actions.start
      .mockResolvedValueOnce(attempt(1, "attempt-1"))
      .mockResolvedValueOnce(attempt(2, "attempt-2"));
    actions.record.mockResolvedValue({
      counted: true,
      firstTryCorrect: false,
      result: { status: "incorrect", reason: "value", message: "Incorrect." },
    });
    actions.complete.mockResolvedValue({
      attemptId: "attempt-1", attemptNumber: 1, score: 0, total: 5, passed: false,
    });
    render(<MeasurementQuiz assignmentId="assignment-1" mode="cylinder_tenths" />);

    await user.click(screen.getByRole("button", { name: "Start quiz" }));
    await screen.findByRole("heading", { name: "Graduated cylinder question 1 of 5" });
    for (let index = 0; index < readings.length; index += 1) {
      await user.type(screen.getByLabelText("Your reading, in milliliters"), "0.0");
      await user.click(screen.getByRole("button", { name: "Check answer" }));
      await screen.findByText("Incorrect.");
      await user.click(screen.getByRole("button", {
        name: index === readings.length - 1 ? "Skip and see results" : "Skip to next question",
      }));
    }
    await screen.findByRole("heading", { name: "Graduated cylinder results: 0 of 5 correct" });

    await user.click(screen.getByRole("button", { name: "Try again with new questions" }));
    await screen.findByRole("heading", { name: "Graduated cylinder question 1 of 5" });
    expect(actions.start).toHaveBeenNthCalledWith(2, "assignment-1", "cylinder_tenths");
  });
});
