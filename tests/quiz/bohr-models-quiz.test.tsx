/** @vitest-environment jsdom */
import "./setup";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import BohrModelsQuiz from "@/components/quiz/bohr/BohrModelsQuiz";
import type { QuizQuestion } from "@/components/quiz/types";

afterEach(cleanup);

function makePool(size: number): QuizQuestion[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `q-${index + 1}`,
    question: `Database question ${index + 1}?`,
    options: ["Wrong A", "Right", "Wrong B", "Wrong C"],
    answerOrder: [0, 1, 2, 3],
  }));
}

describe("BohrModelsQuiz", () => {
  it("draws a 12-question attempt from the pool it is given", async () => {
    render(<BohrModelsQuiz questions={makePool(20)} />);

    expect(await screen.findByText("Question 1 of 12")).toBeInTheDocument();
    expect(screen.getByText(/^Database question \d+\?$/)).toBeInTheDocument();
  });

  it("uses every question when the pool is smaller than an attempt", async () => {
    render(<BohrModelsQuiz questions={makePool(5)} />);

    expect(await screen.findByText("Question 1 of 5")).toBeInTheDocument();
  });

  it("does not reveal answer correctness in the client", async () => {
    const user = userEvent.setup();
    render(<BohrModelsQuiz questions={makePool(3)} />);

    await screen.findByText("Question 1 of 3");
    await user.click(screen.getByRole("radio", { name: "Right" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByRole("status")).toHaveTextContent("Answer recorded");
    expect(screen.queryByText("Correct!")).not.toBeInTheDocument();
  });
});
