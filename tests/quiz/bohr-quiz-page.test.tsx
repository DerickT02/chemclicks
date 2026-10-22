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
const adminClient = vi.hoisted(() => ({ role: "admin" }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminClient }));
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

  it("does not read questions while the quiz is locked", async () => {
    getAccess.mockResolvedValue({ status: "locked" });

    const html = renderToStaticMarkup(await BohrModelQuizPage());

    expect(html).toContain("This quiz is locked");
    expect(listQuestions).not.toHaveBeenCalled();
  });

  it("renders an assignment choice for ambiguous generic entry", async () => {
    getAccess.mockResolvedValue({
      status: "selection",
      assignments: [
        { id: "intro", activity: { title: "Introduction" } },
        { id: "stability", activity: { title: "Stability" } },
      ],
    });

    const html = renderToStaticMarkup(await BohrModelQuizPage());

    expect(html).toContain("Choose the Bohr assignment you want to take.");
    expect(html).toContain("assignmentId=intro");
    expect(html).toContain("assignmentId=stability");
    expect(listQuestions).not.toHaveBeenCalled();
  });

  it("loads the questions from the database and hands them to the quiz", async () => {
    listQuestions.mockResolvedValue({ data: [question, question], error: null });

    const html = renderToStaticMarkup(await BohrModelQuizPage());

    // The server's own client: student sessions are not allowed to read the rows.
    expect(listQuestions).toHaveBeenCalledWith(adminClient, "bohr_models");
    expect(html).toContain("Quiz with 2 questions");
    expect(html).not.toContain("Check your understanding");
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
