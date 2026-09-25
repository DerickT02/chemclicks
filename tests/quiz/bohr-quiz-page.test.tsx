import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const getUser = vi.hoisted(() => vi.fn());
const listQuestions = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/db/quiz-questions", () => ({
  BOHR_QUIZ_KEY: "bohr_models",
  listQuizQuestions: listQuestions,
}));
vi.mock("@/components/quiz/bohr/BohrModelsQuiz", () => ({
  default: ({ questions }: { questions: unknown[] }) => (
    <p>{`Quiz with ${questions.length} questions`}</p>
  ),
}));
import BohrModelQuizPage from "@/app/(student)/student/quizzes/bohr/page";

const question = {
  id: "bohr-boron-outer",
  question: "How many?",
  options: ["2", "3"],
  correctIndex: 1,
};

beforeEach(() => {
  getUser.mockReset();
  listQuestions.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("Bohr quiz page", () => {
  it("sends signed-out visitors to the student login without reading questions", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(BohrModelQuizPage()).rejects.toThrow("REDIRECT:/login/student");
    expect(listQuestions).not.toHaveBeenCalled();
  });

  it("loads the questions from the database and hands them to the quiz", async () => {
    listQuestions.mockResolvedValue({ data: [question, question], error: null });

    const html = renderToStaticMarkup(await BohrModelQuizPage());

    expect(listQuestions).toHaveBeenCalledWith(expect.anything(), "bohr_models");
    expect(html).toContain("Quiz with 2 questions");
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

  it("shows an empty state when there are no active questions", async () => {
    listQuestions.mockResolvedValue({ data: [], error: null });

    const html = renderToStaticMarkup(await BohrModelQuizPage());

    expect(html).toContain("No quiz questions are available right now.");
    expect(html).not.toContain("Quiz with");
    expect(html).not.toContain('role="alert"');
  });
});
