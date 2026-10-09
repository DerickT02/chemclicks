import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const getAccess = vi.hoisted(() => vi.fn());
const listQuestions = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("@/lib/assignments/lewis-quiz-access", () => ({
  getLewisQuizAccess: getAccess,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/components/assignments/AssignmentAccess", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/db/quiz-questions", () => ({
  LEWIS_COVALENT_QUIZ_KEY: "lewis_covalent",
  LEWIS_IONIC_QUIZ_KEY: "lewis_ionic",
  listQuizQuestions: listQuestions,
}));
vi.mock("@/components/quiz/lewis/LewisQuiz", () => ({
  default: ({ title, questions }: { title: string; questions: unknown[] }) => (
    <p>{`${title} with ${questions.length} questions`}</p>
  ),
}));
import LewisQuizPage from "@/components/quiz/lewis/LewisQuizPage";
import CovalentQuizRoute from "@/app/(student)/student/quizzes/covalent/page";
import IonicQuizRoute from "@/app/(student)/student/quizzes/ionic/page";

const question = {
  id: "lewis-n2-bond",
  question: "How many bonds?",
  options: ["Single", "Triple"],
};

beforeEach(() => {
  getAccess.mockReset();
  listQuestions.mockReset();
  getAccess.mockResolvedValue({
    status: "available",
    assignment: { id: "assignment-1", opens_at: null, closes_at: null },
  });
});

describe("Lewis quiz routes", () => {
  it("render the covalent and ionic quiz pages respectively", () => {
    expect(CovalentQuizRoute().props).toEqual({ kind: "covalent" });
    expect(IonicQuizRoute().props).toEqual({ kind: "ionic" });
  });
});

describe.each([
  { kind: "covalent" as const, quizKey: "lewis_covalent", title: "Covalent Compounds Quiz" },
  { kind: "ionic" as const, quizKey: "lewis_ionic", title: "Ionic Compounds Quiz" },
])("$title page", ({ kind, quizKey, title }) => {
  const render = async () => renderToStaticMarkup(await LewisQuizPage({ kind }));

  it("sends signed-out visitors to the student login without reading questions", async () => {
    getAccess.mockResolvedValue({ status: "unauthenticated" });

    await expect(LewisQuizPage({ kind })).rejects.toThrow("REDIRECT:/login/student");
    expect(getAccess).toHaveBeenCalledWith(kind);
    expect(listQuestions).not.toHaveBeenCalled();
  });

  it("loads its own question pool from the database and hands it to the quiz", async () => {
    listQuestions.mockResolvedValue({ data: [question, question, question], error: null });

    const html = await render();

    expect(listQuestions).toHaveBeenCalledWith(expect.anything(), quizKey);
    expect(html).toContain(`${title} with 3 questions`);
    expect(html).not.toContain('role="alert"');
  });

  it("shows a failure state instead of an empty or successful-looking quiz", async () => {
    listQuestions.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied for table quiz_questions" },
    });

    const html = await render();

    expect(html).toContain('role="alert"');
    expect(html).toContain("couldn&#x27;t load the quiz questions");
    expect(html).not.toContain(" with ");
    expect(html).not.toContain("permission denied");
  });

  it("shows an empty state when there are no active questions", async () => {
    listQuestions.mockResolvedValue({ data: [], error: null });

    const html = await render();

    expect(html).toContain("No quiz questions are available right now.");
    expect(html).not.toContain('role="alert"');
  });
});
