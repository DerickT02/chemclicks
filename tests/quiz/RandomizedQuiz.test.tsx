/** @vitest-environment jsdom */
import "./setup";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/components/quiz/random", async importOriginal => {
  const original = await importOriginal<typeof import("@/components/quiz/random")>();
  return { ...original, pickRandomQuestions: vi.fn(original.pickRandomQuestions) };
});
import RandomizedQuiz from "@/components/quiz/RandomizedQuiz";
import { pickRandomQuestions } from "@/components/quiz/random";
import { submitQuizAction } from "@/app/(student)/student/quizzes/actions";
import type { QuizQuestion } from "@/components/quiz/types";

const draw = vi.mocked(pickRandomQuestions);
const submit = vi.mocked(submitQuizAction);
const linked = { assignmentId: "assignment", quizKey: "quiz" };
function pool(prefix = "Original", count = 2): QuizQuestion[] {
  return Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, question: `${prefix} question ${i + 1}?`, options: [`${prefix} right ${i + 1}`, `${prefix} wrong ${i + 1}`] }));
}
beforeEach(() => {
  draw.mockClear();
  submit.mockReset();
  vi.spyOn(Math, "random").mockReturnValue(0.999);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function answer(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("radio", { name: label }));
  await user.click(screen.getByRole("button", { name: "Submit" }));
  // The last answer is saved first, so its results button appears asynchronously.
  await user.click(await screen.findByRole("button", { name: /^(Next question|See results)$/ }));
}

describe("attempt question snapshots", () => {
  it("renders the same loading shell for SSR and draws only after mount", async () => {
    const props = { title: "Quiz", pool: pool(), questionsPerAttempt: 2 };
    const html = renderToString(<RandomizedQuiz {...props} />);
    expect(html).toContain("Loading questions…");
    expect(html).not.toContain("Original question");
    expect(draw).not.toHaveBeenCalled();
    render(<RandomizedQuiz {...props} />);
    expect(await screen.findByText("Original question 1?")).toBeInTheDocument();
    expect(draw).toHaveBeenCalledTimes(1);
  });
  it("draws only once with StrictMode effect replay", async () => {
    render(<StrictMode><RandomizedQuiz title="Quiz" pool={pool()} questionsPerAttempt={2} /></StrictMode>);
    await screen.findByText("Original question 1?");
    expect(draw).toHaveBeenCalledTimes(1);
  });
  it("preserves questions, options, selection and the saved result across fresh and changed server pools", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const failed = { score: 1, total: 2, percent: 50, passed: false, attemptId: "attempt-1", attemptNumber: 1, nextDestination: null };
    const passed = { score: 1, total: 1, percent: 100, passed: true, attemptId: "attempt-2", attemptNumber: 2, nextDestination: null };
    submit.mockResolvedValueOnce(failed).mockResolvedValueOnce(passed);
    const original = pool();
    const view = render(<RandomizedQuiz title="Quiz" pool={original} questionsPerAttempt={2} onComplete={onComplete} {...linked} />);
    await screen.findByText("Original question 1?");
    await user.click(screen.getByRole("radio", { name: "Original right 1" }));
    const options = screen.getAllByRole("radio").map(node => node.outerHTML);
    view.rerender(<RandomizedQuiz title="Quiz" pool={pool()} questionsPerAttempt={2} onComplete={onComplete} {...linked} />);
    expect(screen.getAllByRole("radio").map(node => node.outerHTML)).toEqual(options);
    expect(screen.getByRole("radio", { name: "Original right 1" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    view.rerender(<RandomizedQuiz title="Quiz" pool={pool("Updated", 1)} questionsPerAttempt={1} passingThresholdPercent={20} onComplete={onComplete} {...linked} />);
    expect(screen.getByRole("status")).toHaveTextContent("Answer recorded");
    expect(screen.getByRole("radio", { name: "Original right 1" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByText("Question 2 of 2")).toBeInTheDocument();
    await answer(user, "Original wrong 2");
    // Answers are reported by authored index, whatever order the options were shown in.
    expect(submit).toHaveBeenCalledExactlyOnceWith({ ...linked, submissionKey: expect.any(String), answers: [
      { questionId: "Original-0", selectedIndex: 0 }, { questionId: "Original-1", selectedIndex: 1 },
    ] });
    expect(onComplete).toHaveBeenCalledExactlyOnceWith(failed);
    expect(screen.getByText("Score: 1 / 2 (50%)")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("at least 80%");
    expect(draw).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Updated question 1?")).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(draw).toHaveBeenCalledTimes(2);
    await answer(user, "Updated right 1");
    expect(onComplete).toHaveBeenLastCalledWith(passed);
    // A retry is a new attempt, so it must not reuse the first submission's idempotency key.
    expect(submit.mock.calls[1][0].submissionKey).not.toBe(submit.mock.calls[0][0].submissionKey);
  });
  it("submits a diagram question through the existing server-graded flow", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({
      score: 1,
      total: 1,
      percent: 100,
      passed: true,
      attemptId: "attempt-diagram",
      attemptNumber: 1,
      nextDestination: null,
    });
    render(
      <RandomizedQuiz
        title="Covalent Quiz"
        pool={[{
          id: "lewis-diagram-n2-bond-order",
          question: "Which type of bond is shown?",
          options: ["Triple bond", "Double bond"],
          diagramKey: "n2",
        }]}
        questionsPerAttempt={1}
        {...linked}
      />,
    );

    expect(await screen.findByRole("img", { name: /Nitrogen gas before bonding/ })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Triple bond" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(submit).toHaveBeenCalledWith({
      ...linked,
      submissionKey: expect.any(String),
      answers: [{ questionId: "lewis-diagram-n2-bond-order", selectedIndex: 0 }],
    });
  });
  it("keeps the snapshot independent of in-place source mutations", async () => {
    const original = pool();
    const view = render(<RandomizedQuiz title="Quiz" pool={original} questionsPerAttempt={2} />);
    await screen.findByText("Original question 1?");
    original[0].question = "Mutated question";
    original[0].options[0] = "Mutated option";
    view.rerender(<RandomizedQuiz title="Quiz" pool={original} questionsPerAttempt={2} />);
    expect(screen.getByText("Original question 1?")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Original right 1" })).toBeInTheDocument();
    expect(screen.queryByText("Mutated question")).not.toBeInTheDocument();
  });
  it("retains a current attempt across a load failure/recovery but cannot start a retry from failed data", async () => {
    const user = userEvent.setup();
    const view = render(<RandomizedQuiz title="Quiz" pool={pool("Original", 1)} questionsPerAttempt={1} />);
    await screen.findByText("Original question 1?");
    await user.click(screen.getByRole("radio", { name: "Original right 1" }));
    view.rerender(<RandomizedQuiz title="Quiz" pool={[]} questionsPerAttempt={1} loadError="Questions could not be loaded." />);
    expect(screen.getByRole("alert")).toHaveTextContent("current attempt is unchanged");
    expect(screen.getByRole("radio", { name: "Original right 1" })).toBeChecked();
    view.rerender(<RandomizedQuiz title="Quiz" pool={pool("Recovered", 1)} questionsPerAttempt={1} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Original question 1?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await user.click(screen.getByRole("button", { name: "See results" }));
    view.rerender(<RandomizedQuiz title="Quiz" pool={[]} questionsPerAttempt={1} loadError="Questions could not be loaded." />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Questions could not be loaded.");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to assignments" })).toHaveAttribute("href", "/student");
    expect(draw).toHaveBeenCalledTimes(1);
  });
  it("keeps a current attempt if a refreshed bank becomes empty, then shows empty on explicit retry", async () => {
    const user = userEvent.setup();
    const view = render(<RandomizedQuiz title="Quiz" pool={pool("Original", 1)} questionsPerAttempt={1} />);
    await screen.findByText("Original question 1?");
    view.rerender(<RandomizedQuiz title="Quiz" pool={[]} questionsPerAttempt={1} />);
    await answer(user, "Original right 1");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("No quiz questions are available right now.")).toBeInTheDocument();
    expect(screen.queryByText("Loading questions…")).not.toBeInTheDocument();
  });
  it("shows empty without endless loading and can initialize when data arrives before an attempt starts", async () => {
    const view = render(<RandomizedQuiz title="Quiz" pool={[]} questionsPerAttempt={12} />);
    expect(screen.getByRole("status")).toHaveTextContent("No quiz questions");
    expect(screen.getByRole("link", { name: "Back to assignments" })).toHaveAttribute("href", "/student");
    expect(draw).not.toHaveBeenCalled();
    view.rerender(<RandomizedQuiz title="Quiz" pool={pool()} questionsPerAttempt={12} />);
    expect(await screen.findByText("Question 1 of 2")).toBeInTheDocument();
  });
  it.each([0, -1, NaN, Infinity, 1.5])("fails closed for an invalid draw count (%s)", count => {
    render(<RandomizedQuiz title="Quiz" pool={pool()} questionsPerAttempt={count} />);
    expect(screen.getByRole("alert")).toHaveTextContent("could not be started");
    expect(screen.queryByText("Loading questions…")).not.toBeInTheDocument();
    expect(draw).not.toHaveBeenCalled();
  });
  it("cancels a pending initialization when unmounted", async () => {
    vi.useFakeTimers();
    try {
      const view = render(<RandomizedQuiz title="Quiz" pool={pool()} questionsPerAttempt={2} />);
      view.unmount();
      await act(async () => { vi.runAllTimers(); });
      expect(draw).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
});
