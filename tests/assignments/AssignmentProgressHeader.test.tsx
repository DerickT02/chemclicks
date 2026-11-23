// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AssignmentProgressHeader } from "@/components/assignments/AssignmentProgressHeader";
import { QuizScore } from "@/components/assignments/QuizScore";
import { ASSIGNMENT_STAGES, type AssignmentStage } from "@/lib/assignments/stages";
import type { AssignmentProgressFacts } from "@/lib/assignments/progress";
import { progressFacts } from "../testing/progress";

afterEach(cleanup);

function progressView(facts: AssignmentProgressFacts) {
  return (
    <AssignmentProgressHeader
      stage={facts.stage}
      label="Alex Kim, Bohr Models"
      title={<h3>Alex Kim</h3>}
      quizResult={<QuizScore facts={facts} />}
    />
  );
}

describe("teacher assignment status and quiz result", () => {
  it.each(Object.keys(ASSIGNMENT_STAGES) as AssignmentStage[])("shows labelled completion steps for the %s stage", stage => {
    render(progressView(progressFacts({ stage })));
    expect(screen.getByText(ASSIGNMENT_STAGES[stage].label)).toBeTruthy();
    const steps = screen.getByRole("list", { name: "Alex Kim, Bohr Models, assignment completion" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Assignment completion").nextElementSibling).toBe(steps);
    expect(steps.textContent).not.toContain("%");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("distinguishes assignment completion from the labelled quiz score", () => {
    render(progressView(progressFacts({
      stage: "completed", passingQuizAttemptNumber: 2,
      passingQuizScore: 10, passingQuizTotal: 12, passingQuizPercentage: 83.33,
    })));
    expect(screen.queryAllByRole("term")).toHaveLength(0);
    expect(screen.getByText("Alex Kim").nextElementSibling?.textContent).toBe("Completed");
    expect(screen.getByText("Quiz score: 10/12 (83.33%) · Passed on attempt 2")).toBeTruthy();
    expect(screen.getByText("Assignment completion")).toBeTruthy();
    expect(screen.queryByText("100%")).toBeNull();
    expect(screen.getByRole("list").querySelector('[aria-current="step"]')).toBeNull();
  });

  it("updates the milestones when live progress changes without using the quiz percentage", () => {
    const { rerender } = render(progressView(progressFacts({ stage: "exploring" })));
    expect(screen.getByRole("list").querySelector('[aria-current="step"]')?.textContent).toContain("Exploration finished");
    rerender(progressView(progressFacts({
      stage: "completed", passingQuizAttemptNumber: 1,
      passingQuizScore: 4, passingQuizTotal: 5, passingQuizPercentage: 80,
    })));
    expect(screen.getByRole("list").querySelector('[aria-current="step"]')).toBeNull();
    for (const step of screen.getAllByRole("listitem")) expect(step.textContent).toContain(", completed");
    expect(screen.getByText("Quiz score: 4/5 (80%) · Passed on attempt 1")).toBeTruthy();
  });

  it("does not invent a score when a passing attempt has no saved score", () => {
    render(progressView(progressFacts({ stage: "completed", passingQuizAttemptNumber: 1 })));
    expect(screen.getByText("Quiz passed on attempt 1")).toBeTruthy();
    expect(screen.queryByText(/Quiz score:/)).toBeNull();
  });

  it("labels a saved zero score rather than treating it as missing", () => {
    render(progressView(progressFacts({
      stage: "completed", passingQuizAttemptNumber: 1,
      passingQuizScore: 0, passingQuizTotal: 5, passingQuizPercentage: 0,
    })));
    expect(screen.getByText("Quiz score: 0/5 (0%) · Passed on attempt 1")).toBeTruthy();
  });

  it.each([
    [progressFacts({ stage: "explored" }), "Quiz not started"],
    [progressFacts({ stage: "quiz_in_progress" }), "Quiz in progress"],
  ])("does not invent a quiz score when a passing result is unavailable", (facts, expected) => {
    render(progressView(facts));
    const result = screen.getByText(expected);
    expect(result.textContent).not.toContain("%");
  });

  it("leaves the quiz result out for a student who has not started", () => {
    render(progressView(progressFacts()));
    expect(screen.getAllByText("Not started")).toHaveLength(1);
    expect(screen.queryByText(/^Quiz (score:|passed on attempt|in progress|not started)/)).toBeNull();
  });

  it.each([
    [1, "1 quiz attempt submitted"],
    [2, "2 quiz attempts submitted"],
  ])("counts %i submitted attempt(s) when the quiz is not passed yet", (failedQuizAttemptCount, expected) => {
    render(progressView(progressFacts({ stage: "needs_retry", failedQuizAttemptCount })));
    expect(screen.getByText("Quiz not passed, needs retry")).toBeTruthy();
    expect(screen.getByText(expected)).toBeTruthy();
    expect(screen.queryByText(/not passed yet/)).toBeNull();
  });
});
