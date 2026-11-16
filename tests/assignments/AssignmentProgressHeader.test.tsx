// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

describe("teacher assignment status and quiz score", () => {
  it.each(Object.keys(ASSIGNMENT_STAGES) as AssignmentStage[])("anchors the completion bubble to the %s stage", stage => {
    render(progressView(progressFacts({ stage })));
    const { percent, label } = ASSIGNMENT_STAGES[stage];
    const bar = screen.getByRole("progressbar", { name: "Alex Kim, Bohr Models, assignment completion" });
    expect(bar.getAttribute("aria-valuenow")).toBe(String(percent));
    expect(bar.getAttribute("aria-valuetext")).toBe(label);
    expect(screen.getByText("Assignment status").nextElementSibling?.textContent).toBe(label);
    const bubble = screen.getByText(`${percent}%`);
    expect(bubble.parentElement).toBe(bar);
    expect(bubble.getAttribute("aria-hidden")).toBe("true");
    expect(bubble.style.left).toBe(`${percent}%`);
    // Align the label inward at either edge to avoid overflowing narrow screens.
    expect(bubble.className).toContain(percent === 0 ? "translate-x-0" : percent === 100 ? "-translate-x-full" : "-translate-x-1/2");
    expect((bar.lastElementChild as HTMLElement).style.width).toBe(`${percent}%`);
  });

  it("keeps assignment status on the left and the passing quiz result on the right", () => {
    render(progressView(progressFacts({
      stage: "completed", passingQuizAttemptNumber: 2,
      passingQuizScore: 10, passingQuizTotal: 12, passingQuizPercentage: 83.33,
    })));
    const terms = screen.getAllByRole("term");
    expect(terms.map(term => term.textContent)).toEqual(["Assignment status", "Quiz score"]);
    expect(terms[0].nextElementSibling?.textContent).toBe("Completed");
    expect(terms[1].parentElement?.className).toContain("sm:text-right");
    expect(terms[1].nextElementSibling?.textContent).toBe("Passed on attempt 2: 10/12 (83.33%)");
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("moves the completion bubble when live progress changes without using the quiz percentage", () => {
    const { rerender } = render(progressView(progressFacts({ stage: "exploring" })));
    expect(screen.getByText("33%")).toBeTruthy();
    rerender(progressView(progressFacts({
      stage: "completed", passingQuizAttemptNumber: 1,
      passingQuizScore: 4, passingQuizTotal: 5, passingQuizPercentage: 80,
    })));
    expect(screen.queryByText("33%")).toBeNull();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByText("100%").style.left).toContain("100%");
    expect(screen.getByText("Passed on attempt 1: 4/5 (80%)")).toBeTruthy();
  });

  it.each([
    [progressFacts(), "Not started"],
    [progressFacts({ stage: "quiz_in_progress" }), "In progress"],
    [progressFacts({ stage: "needs_retry", failedQuizAttemptCount: 2 }), "Not passed yet · 2 attempts submitted"],
  ])("does not invent a quiz score when a passing result is unavailable", (facts, expected) => {
    render(progressView(facts));
    const score = screen.getByText("Quiz score").nextElementSibling;
    expect(score?.textContent).toBe(expected);
    expect(score?.textContent).not.toContain("%");
  });
});
