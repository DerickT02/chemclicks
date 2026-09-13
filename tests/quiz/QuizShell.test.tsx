/** @vitest-environment jsdom */
import "./setup";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import QuizShell from "@/components/quiz/QuizShell";
import type { QuizQuestion } from "@/components/quiz/types";

afterEach(() => {
  cleanup();
});

const QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    question: "Where are protons located?",
    options: ["Shells", "Nucleus", "Orbit", "Outside"],
    correctIndex: 1,
  },
  {
    id: "q2",
    question: "How many electrons can the first shell hold?",
    options: ["8", "2", "18", "4"],
    correctIndex: 1,
  },
  {
    id: "q3",
    question: "A neutral oxygen atom has how many electrons?",
    options: ["6", "8", "16", "2"],
    correctIndex: 1,
  },
  {
    id: "q4",
    question: "A neutral atom with shell distribution 2, 8 is which element?",
    options: ["Oxygen", "Neon", "Sodium", "Fluorine"],
    correctIndex: 1,
  },
  {
    id: "q5",
    question: "Which shell fills first in the Bohr model?",
    options: [
      "Outermost",
      "Closest to the nucleus",
      "Third",
      "All at once",
    ],
    correctIndex: 1,
  },
];

function renderQuiz(
  overrides: Partial<ComponentProps<typeof QuizShell>> = {},
) {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  const view = render(
    <QuizShell
      title="Test Quiz"
      questions={QUESTIONS}
      passingThresholdPercent={80}
      onComplete={onComplete}
      {...overrides}
    />,
  );
  return { user, onComplete, ...view };
}

async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  await user.click(screen.getByRole("radio", { name: label }));
}

async function submitAnswer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Submit" }));
}

async function goNext(user: ReturnType<typeof userEvent.setup>) {
  const next = screen.queryByRole("button", { name: "Next question" });
  const results = screen.queryByRole("button", { name: "See results" });
  const button = next ?? results;
  expect(button).toBeTruthy();
  await user.click(button!);
}

async function answerCurrent(
  user: ReturnType<typeof userEvent.setup>,
  optionLabel: string,
) {
  await selectOption(user, optionLabel);
  await submitAnswer(user);
  await goNext(user);
}

describe("QuizShell", () => {
  it("allows answer selection", async () => {
    const { user } = renderQuiz();

    const nucleus = screen.getByRole("radio", { name: "Nucleus" });
    expect(nucleus).not.toBeChecked();

    await user.click(nucleus);

    expect(nucleus).toBeChecked();
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });

  it("blocks incomplete submission until an answer is selected", async () => {
    const { user } = renderQuiz();

    const submit = screen.getByRole("button", { name: "Submit" });
    expect(submit).toBeDisabled();

    await user.click(submit);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Question 1 of 5")).toBeInTheDocument();
    expect(screen.getByText("Where are protons located?")).toBeInTheDocument();
  });

  it("shows Correct! feedback for a right answer", async () => {
    const { user } = renderQuiz();

    await selectOption(user, "Nucleus");
    await submitAnswer(user);

    expect(screen.getByRole("status")).toHaveTextContent("Correct!");
    expect(
      screen.getByRole("button", { name: "Next question" }),
    ).toBeInTheDocument();
  });

  it("shows Incorrect feedback and the right answer for a wrong choice", async () => {
    const { user } = renderQuiz();

    await selectOption(user, "Shells");
    await submitAnswer(user);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Incorrect. The correct answer is: Nucleus",
    );
  });

  it("calculates score from correct and incorrect answers", async () => {
    const { user, onComplete } = renderQuiz();

    // 4 correct, 1 incorrect → 80%
    await answerCurrent(user, "Nucleus"); // q1 correct
    await answerCurrent(user, "2"); // q2 correct
    await answerCurrent(user, "6"); // q3 incorrect
    await answerCurrent(user, "Neon"); // q4 correct
    await selectOption(user, "Closest to the nucleus"); // q5 correct
    await submitAnswer(user);

    expect(onComplete).toHaveBeenCalledWith({
      score: 4,
      total: 5,
      percent: 80,
      passed: true,
    });

    await goNext(user);

    expect(screen.getByText("Section Quiz — Complete")).toBeInTheDocument();
    expect(screen.getByText("Score: 4 / 5 (80%)")).toBeInTheDocument();
  });

  it("shows completion state with fail messaging below the threshold", async () => {
    const { user, onComplete } = renderQuiz();

    // 3 correct, 2 incorrect → 60%
    await answerCurrent(user, "Nucleus");
    await answerCurrent(user, "8"); // incorrect
    await answerCurrent(user, "8");
    await answerCurrent(user, "Oxygen"); // incorrect
    await selectOption(user, "Closest to the nucleus");
    await submitAnswer(user);

    expect(onComplete).toHaveBeenCalledWith({
      score: 3,
      total: 5,
      percent: 60,
      passed: false,
    });

    await goNext(user);

    const results = screen.getByText("Section Quiz — Complete").closest("article");
    expect(results).toBeTruthy();
    expect(
      within(results!).getByText("Score: 3 / 5 (60%)"),
    ).toBeInTheDocument();
    expect(
      within(results!).getByRole("status"),
    ).toHaveTextContent("Not passed — you need at least 80% to pass.");
    expect(
      within(results!).getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(
      within(results!).queryByRole("button", {
        name: "Continue to next section",
      }),
    ).not.toBeInTheDocument();
  });

  it("shows completion state with pass messaging and continue button", async () => {
    const { user } = renderQuiz();

    await answerCurrent(user, "Nucleus");
    await answerCurrent(user, "2");
    await answerCurrent(user, "8");
    await answerCurrent(user, "Neon");
    await selectOption(user, "Closest to the nucleus");
    await submitAnswer(user);
    await goNext(user);

    const results = screen.getByText("Section Quiz — Complete").closest("article");
    expect(results).toBeTruthy();
    expect(
      within(results!).getByText("Score: 5 / 5 (100%)"),
    ).toBeInTheDocument();
    expect(
      within(results!).getByRole("status"),
    ).toHaveTextContent("Passed — you needed 80% or higher.");
    expect(
      within(results!).getByRole("button", {
        name: "Continue to next section",
      }),
    ).toBeInTheDocument();
  });
});
