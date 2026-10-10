/** @vitest-environment jsdom */
import "./setup";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import QuizShell from "@/components/quiz/QuizShell";
import type { QuizQuestion } from "@/components/quiz/types";

afterEach(() => cleanup());

const QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    question: "Where are protons located?",
    options: ["Shells", "Nucleus", "Orbit", "Outside"],
    answerOrder: [0, 1, 2, 3],
  },
  {
    id: "q2",
    question: "How many electrons can the first shell hold?",
    options: ["8", "2", "18", "4"],
    answerOrder: [0, 1, 2, 3],
  },
];

function renderQuiz(
  overrides: Partial<ComponentProps<typeof QuizShell>> = {},
) {
  const user = userEvent.setup();
  const onSubmit = vi.fn().mockResolvedValue({
    score: 2,
    total: 2,
    percent: 100,
    passed: true,
    attemptId: "attempt-1",
    nextDestination: "/student/assignments/next",
  });
  const view = render(
    <QuizShell
      title="Test Quiz"
      questions={QUESTIONS}
      passingThresholdPercent={80}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { user, onSubmit, ...view };
}

async function answerQuestion(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  await user.click(screen.getByRole("radio", { name: label }));
  await user.click(screen.getByRole("button", { name: "Submit" }));
}

describe("QuizShell", () => {
  it("allows answer selection without exposing correctness", async () => {
    const { user } = renderQuiz();

    await user.click(screen.getByRole("radio", { name: "Nucleus" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Answer recorded. Continue to the next question.",
    );
    expect(screen.queryByText("Correct!")).not.toBeInTheDocument();
    expect(screen.queryByText(/The correct answer is/)).not.toBeInTheDocument();
  });

  it("uses the server result and destination after the final answer", async () => {
    const { user, onSubmit } = renderQuiz();

    await answerQuestion(user, "Nucleus");
    await user.click(screen.getByRole("button", { name: "Next question" }));
    await answerQuestion(user, "2");

    expect(onSubmit).toHaveBeenCalledWith([
      { questionId: "q1", selectedIndex: 1 },
      { questionId: "q2", selectedIndex: 1 },
    ]);

    await user.click(screen.getByRole("button", { name: "See results" }));

    expect(screen.getByText("Score: 2 / 2 (100%)")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continue to next section" }),
    ).toHaveAttribute("href", "/student/assignments/next");
  });

  it("does not render a next destination for a failed server result", async () => {
    const { user } = renderQuiz({
      onSubmit: vi.fn().mockResolvedValue({
        score: 1,
        total: 2,
        percent: 50,
        passed: false,
        attemptId: "attempt-1",
        nextDestination: null,
      }),
    });

    await answerQuestion(user, "Nucleus");
    await user.click(screen.getByRole("button", { name: "Next question" }));
    await answerQuestion(user, "8");
    await user.click(screen.getByRole("button", { name: "See results" }));

    expect(screen.getByText("Score: 1 / 2 (50%)")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Continue to next section" }),
    ).not.toBeInTheDocument();
  });

  it("shows a retry action when saving the final result fails", async () => {
    const { user } = renderQuiz({
      onSubmit: vi.fn().mockRejectedValue(new Error("Save failed")),
    });

    await answerQuestion(user, "Nucleus");
    await user.click(screen.getByRole("button", { name: "Next question" }));
    await answerQuestion(user, "2");

    expect(screen.getByRole("alert")).toHaveTextContent("Save failed");
    expect(screen.getByRole("button", { name: "Retry save" })).toBeEnabled();
  });
});
