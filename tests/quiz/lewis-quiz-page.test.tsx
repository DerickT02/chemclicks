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
  LEWIS_QUIZ_KEY: "lewis_bonding",
  listQuizQuestions: listQuestions,
}));
vi.mock("@/components/quiz/lewis/LewisBondingQuiz", () => ({
  default: ({ questions }: { questions: unknown[] }) => (
    <p>{`Quiz with ${questions.length} questions`}</p>
  ),
}));
import LewisBondingQuizPage from "@/app/(student)/student/quizzes/lewis/page";

const question = {
  id: "lewis-n2-bond",
  question: "How many bonds?",
  options: ["Single", "Triple"],
  correctIndex: 1,
};

beforeEach(() => {
  getUser.mockReset();
  listQuestions.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("Lewis quiz page", () => {
  it("sends signed-out visitors to the student login without reading questions", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(LewisBondingQuizPage()).rejects.toThrow("REDIRECT:/login/student");
    expect(listQuestions).not.toHaveBeenCalled();
  });

  it("loads the Lewis questions from the database and hands them to the quiz", async () => {
    listQuestions.mockResolvedValue({ data: [question, question, question], error: null });

    const html = renderToStaticMarkup(await LewisBondingQuizPage());

    expect(listQuestions).toHaveBeenCalledWith(expect.anything(), "lewis_bonding");
    expect(html).toContain("Quiz with 3 questions");
    expect(html).not.toContain('role="alert"');
  });

  it("shows a failure state instead of an empty or successful-looking quiz", async () => {
    listQuestions.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied for table quiz_questions" },
    });

    const html = renderToStaticMarkup(await LewisBondingQuizPage());

    expect(html).toContain('role="alert"');
    expect(html).toContain("couldn&#x27;t load the quiz questions");
    expect(html).not.toContain("Quiz with");
    expect(html).not.toContain("permission denied");
  });

  it("shows an empty state when there are no active questions", async () => {
    listQuestions.mockResolvedValue({ data: [], error: null });

    const html = renderToStaticMarkup(await LewisBondingQuizPage());

    expect(html).toContain("No quiz questions are available right now.");
    expect(html).not.toContain("Quiz with");
    expect(html).not.toContain('role="alert"');
  });
});
