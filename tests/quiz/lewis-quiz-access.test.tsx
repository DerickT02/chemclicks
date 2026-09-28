import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ reader: vi.fn(), listQuestions: vi.fn(), adminClient: {} }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/student-assignments", () => ({ getStudentAssignments: mocks.reader }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mocks.adminClient }));
vi.mock("@/lib/db/quiz-questions", () => ({
  LEWIS_COVALENT_QUIZ_KEY: "lewis_covalent",
  LEWIS_IONIC_QUIZ_KEY: "lewis_ionic",
  listQuizQuestions: mocks.listQuestions,
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));
vi.mock("@/components/assignments/AssignmentAccess", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/quiz/lewis/LewisQuiz", () => ({
  default: ({ title, questions }: { title: string; questions: unknown[] }) =>
    <p>{`Started ${title} with ${questions.length} questions`}</p>,
}));
vi.mock("@/components/lewis/LewisDotExplorer", () => ({ default: () => <p>Lewis exercise</p> }));
vi.mock("@/components/lewis/IonicCompoundExplorer", () => ({ default: () => <p>Ionic exercise</p> }));
vi.mock("@/components/measurement/GraduatedCylinder", () => ({ default: () => null }));
vi.mock("@/components/measurement/PrecisionRuler", () => ({ default: () => null }));

import LewisQuizPage from "@/components/quiz/lewis/LewisQuizPage";
import AssignmentPage from "@/app/(student)/student/assignments/[assignmentId]/page";
import { getLewisQuizAccess } from "@/lib/assignments/lewis-quiz-access";

const HOUR = 60 * 60 * 1000;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();

function assignmentOf(type: string, window: { opens_at?: string | null; closes_at?: string | null } = {}) {
  return {
    id: `assignment-${type}`,
    opens_at: window.opens_at ?? null,
    closes_at: window.closes_at ?? null,
    activity: { id: `activity-${type}`, title: type, type, order_index: 1 },
  };
}
const covalentLesson = assignmentOf("lewis_structures_covalent");
const ionicLesson = assignmentOf("lewis_structures_ionic");
const diagram = assignmentOf("lewis_diagram");
const question = { id: "q1", question: "Q?", options: ["A", "B"], correctIndex: 0 };

const withAssignments = (assignments: unknown[]) =>
  mocks.reader.mockResolvedValue({ status: "ok", assignments });
const renderQuizFor = async (kind: "covalent" | "ionic") =>
  renderToStaticMarkup(await LewisQuizPage({ kind }));
const renderAssignment = async (id: string) =>
  renderToStaticMarkup(await AssignmentPage({ params: Promise.resolve({ assignmentId: id }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listQuestions.mockResolvedValue({ data: [question], error: null });
});

const QUIZZES = [
  {
    kind: "covalent" as const, title: "Covalent Compounds Quiz", quizKey: "lewis_covalent",
    lesson: covalentLesson, otherLesson: ionicLesson, lessonTitle: "Lewis Structures — Covalent",
    path: "/student/quizzes/covalent",
  },
  {
    kind: "ionic" as const, title: "Ionic Compounds Quiz", quizKey: "lewis_ionic",
    lesson: ionicLesson, otherLesson: covalentLesson, lessonTitle: "Lewis Structures — Ionic",
    path: "/student/quizzes/ionic",
  },
];

describe.each(QUIZZES)("$title unlocked by its lesson assignment", ({ kind, title, quizKey, lesson, otherLesson, lessonTitle, path }) => {
  const renderQuiz = () => renderQuizFor(kind);
  const started = `Started ${title}`;

  function expectLocked(html: string) {
    expect(html).toContain("This quiz is locked.");
    expect(html).toContain(`Your teacher must assign the ${lessonTitle} lesson to your class`);
    expect(html).not.toContain("Started ");
    expect(mocks.listQuestions).not.toHaveBeenCalled();
  }

  it("is locked when neither lesson is assigned", async () => {
    withAssignments([]);
    expect(await getLewisQuizAccess(kind)).toEqual({ status: "locked" });
    expectLocked(await renderQuiz());
  });

  it("opens when its lesson is assigned to the student's class, loading its questions on the server", async () => {
    withAssignments([lesson]);
    const html = await renderQuiz();
    expect(html).toContain(`${started} with 1 questions`);
    expect(html).not.toContain("This quiz is locked.");
    expect(mocks.listQuestions).toHaveBeenCalledWith(mocks.adminClient, quizKey);
  });

  it("stays locked when only the other lesson is assigned", async () => {
    withAssignments([otherLesson]);
    expect(await getLewisQuizAccess(kind)).toEqual({ status: "locked" });
    expectLocked(await renderQuiz());
  });

  it("stays locked when only the Lewis dot diagram lesson is assigned", async () => {
    withAssignments([diagram]);
    expectLocked(await renderQuiz());
  });

  it("stays locked when only another class has the lesson assigned", async () => {
    // The server reader returns only the signed-in student's own class rows.
    withAssignments([]);
    const html = await renderQuiz();
    expectLocked(html);
    expect(html).toContain('href="/student"');
  });

  it("blocks direct route access while unassigned without rendering quiz content", async () => {
    withAssignments([diagram, otherLesson]);
    expectLocked(await renderQuiz());
  });

  it("redirects unauthenticated or inactive-class requests to login", async () => {
    mocks.reader.mockResolvedValue({ status: "unauthenticated" });
    await expect(LewisQuizPage({ kind })).rejects.toThrow("REDIRECT:/login/student");
    expect(mocks.listQuestions).not.toHaveBeenCalled();
  });

  it("is locked before the lesson opens and after it closes", async () => {
    withAssignments([{ ...lesson, opens_at: iso(HOUR) }]);
    expectLocked(await renderQuiz());
    withAssignments([{ ...lesson, closes_at: iso(-HOUR) }]);
    expectLocked(await renderQuiz());
  });

  it("opens inside the lesson's availability window", async () => {
    withAssignments([{ ...lesson, opens_at: iso(-HOUR), closes_at: iso(HOUR) }]);
    expect(await renderQuiz()).toContain(started);
  });

  it("locks again once the lesson assignment is removed or closed", async () => {
    withAssignments([lesson]);
    expect(await renderQuiz()).toContain(started);
    vi.clearAllMocks();
    withAssignments([]);
    expectLocked(await renderQuiz());
    withAssignments([{ ...lesson, closes_at: iso(-1000) }]);
    expectLocked(await renderQuiz());
  });

  it("offers the quiz from its lesson page", async () => {
    withAssignments([lesson]);
    const html = await renderAssignment(lesson.id);
    expect(html).toContain(title);
    expect(html).toContain(`href="${path}"`);
    expect(html).toContain("Start quiz");
  });
});

describe("independent Lewis quizzes", () => {
  it("opens both quizzes when both lessons are assigned", async () => {
    withAssignments([covalentLesson, ionicLesson]);
    expect(await renderQuizFor("covalent")).toContain("Started Covalent Compounds Quiz");
    expect(await renderQuizFor("ionic")).toContain("Started Ionic Compounds Quiz");
    expect(mocks.listQuestions).toHaveBeenCalledWith(mocks.adminClient, "lewis_covalent");
    expect(mocks.listQuestions).toHaveBeenCalledWith(mocks.adminClient, "lewis_ionic");
  });

  it.each([
    { closed: "covalent" as const, open: "ionic" as const },
    { closed: "ionic" as const, open: "covalent" as const },
  ])("closing the $closed lesson locks only the $closed quiz", async ({ closed, open }) => {
    const lessons = { covalent: covalentLesson, ionic: ionicLesson };
    withAssignments([{ ...lessons[closed], closes_at: iso(-1000) }, lessons[open]]);
    expect(await renderQuizFor(closed)).toContain("This quiz is locked.");
    expect(await renderQuizFor(open)).toContain("Started ");
  });

  it("shows no quiz cards on the Lewis dot diagram page", async () => {
    withAssignments([diagram, covalentLesson, ionicLesson]);
    const html = await renderAssignment(diagram.id);
    expect(html).toContain("Lewis exercise");
    expect(html).not.toContain("Compounds Quiz");
    expect(html).not.toContain("/student/quizzes/");
  });

  it("shows only the matching quiz card on each lesson page", async () => {
    withAssignments([covalentLesson, ionicLesson]);
    const covalentHtml = await renderAssignment(covalentLesson.id);
    expect(covalentHtml).toContain("Covalent Compounds Quiz");
    expect(covalentHtml).not.toContain("Ionic Compounds Quiz");
    const ionicHtml = await renderAssignment(ionicLesson.id);
    expect(ionicHtml).toContain("Ionic Compounds Quiz");
    expect(ionicHtml).not.toContain("Covalent Compounds Quiz");
  });
});
