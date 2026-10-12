import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const getAccess = vi.hoisted(() => vi.fn());
const listQuestions = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("@/lib/assignments/bohr-quiz-access", () => ({
  getBohrQuizAccess: getAccess,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
}));
vi.mock("@/lib/db/quiz-questions", () => ({
  BOHR_QUIZ_KEY: "bohr_models",
  listQuizQuestions: listQuestions,
}));
vi.mock("@/components/quiz/bohr/BohrModelsQuiz", () => ({
  default: ({ questions, loadError }: { questions: unknown[]; loadError?: string | null }) => loadError
    ? <p role="alert">{loadError}</p>
    : questions.length === 0 ? <p>No quiz questions are available right now.</p>
    : <p>{`Quiz with ${questions.length} questions`}</p>,
}));
import BohrModelQuizPage from "@/app/(student)/student/quizzes/bohr/page";

const question = {
  id: "bohr-boron-outer",
  question: "How many?",
  options: ["2", "3"],
};

beforeEach(() => {
  getAccess.mockReset();
  listQuestions.mockReset();
  getAccess.mockResolvedValue({
    status: "available",
    assignment: { id: "assignment-1", opens_at: null, closes_at: null },
  });
});

describe("Bohr quiz page", () => {
  it("sends signed-out visitors to the student login without reading questions", async () => {
    getAccess.mockResolvedValue({ status: "unauthenticated" });

    await expect(BohrModelQuizPage()).rejects.toThrow("REDIRECT:/login/student");
    expect(listQuestions).not.toHaveBeenCalled();
  });

  it("loads the questions from the database and hands them to the quiz", async () => {
    listQuestions.mockResolvedValue({ data: [question, question], error: null });

    const html = renderToStaticMarkup(await BohrModelQuizPage());

    expect(listQuestions).toHaveBeenCalledWith(expect.anything(), "bohr_models");
    expect(html).toContain("Quiz with 2 questions");
    expect(html).toContain("Your score is saved for your teacher when you finish.");
    expect(html).not.toContain("Back to");
    expect(html).not.toContain('href="/student/labs/bohr-models"');
    expect(html).not.toContain("before moving on");
    expect(html).not.toContain('role="alert"');
  });

  it("shows a failure state instead of an empty or successful-looking quiz", async () => {
    listQuestions.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied for table quiz_questions" },
    });

    const html = renderToStaticMarkup(await BohrModelQuizPage());

    expect(html).toContain('role="alert"');
    expect(html).toContain("couldn&#x27;t load the quiz questions");
    expect(html).not.toContain("Quiz with");
    expect(html).not.toContain("permission denied");
  });

  it("keeps a recoverable quiz boundary and sanitizes thrown question-load failures", async () => {
    listQuestions.mockRejectedValue(new Error("private query credentials"));
    const html = renderToStaticMarkup(await BohrModelQuizPage());
    expect(html).toContain('role="alert"');
    expect(html).toContain("couldn&#x27;t load the quiz questions");
    expect(html).not.toContain("private query credentials");
    expect(html).not.toContain("Quiz with");
  });

  it("shows an empty state when there are no active questions", async () => {
    listQuestions.mockResolvedValue({ data: [], error: null });

    const html = renderToStaticMarkup(await BohrModelQuizPage());

    expect(html).toContain("No quiz questions are available right now.");
    expect(html).not.toContain("Quiz with");
    expect(html).not.toContain('role="alert"');
  });
});
