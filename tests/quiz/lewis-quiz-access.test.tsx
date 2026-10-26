vi.mock('@/lib/server/student-assignments', () => ({ getAssignmentAttempts: async () => [] }));
vi.mock('@/app/(student)/student/assignments/[assignmentId]/AttemptControls', () => ({ default: () => <button>Start exploration</button> }));
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  reader: vi.fn(),
  attempts: vi.fn(),
  listQuestions: vi.fn(),
  gate: vi.fn(),
  adminClient: {},
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/student-assignments", () => ({
  getStudentAssignments: mocks.reader,
  getStudentAssignmentSchedules: mocks.reader,
}));
vi.mock("@/lib/assignments/prerequisites", async (importOriginal) => {
  // Keep the real schedule checks; stub only the progress-backed gate.
  const actual = await importOriginal<typeof import("@/lib/assignments/prerequisites")>();
  const { scheduleStatus } = await import("@/lib/assignments/schedule");
  return {
    ...actual,
    getAssignmentGate: mocks.gate,
    getSectionAccess: async (assignment: { id: string; opens_at: string | null; closes_at: string | null }) => {
      const status = scheduleStatus(assignment, Date.now());
      if (status === "Scheduled") return { status: "scheduled", assignment };
      if (status !== "Open") return { status: "closed", assignment };
      const gate = await mocks.gate(assignment.id);
      return gate.status === "locked"
        ? { status: "blocked", assignment, blocker: gate.blocker }
        : { status: "available", assignment };
    },
  };
});
vi.mock("@/lib/server/student-assignments", () => ({ getAssignmentAttempts: mocks.attempts }));
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
const question = { id: "q1", question: "Q?", options: ["A", "B"] };

const withAssignments = (assignments: unknown[]) =>
  mocks.reader.mockResolvedValue({ status: "ok", assignments });
const renderQuizFor = async (kind: "covalent" | "ionic") =>
  renderToStaticMarkup(await LewisQuizPage({ kind }));
const renderAssignment = async (id: string) =>
  renderToStaticMarkup(await AssignmentPage({ params: Promise.resolve({ assignmentId: id }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.attempts.mockResolvedValue([]);
  mocks.listQuestions.mockResolvedValue({ data: [question], error: null });
  mocks.gate.mockResolvedValue({ status: "open", entry: { complete: false }, next: null });
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

  it("distinguishes scheduled and closed work without loading questions", async () => {
    withAssignments([{ ...lesson, opens_at: iso(HOUR) }]);
    expect((await getLewisQuizAccess(kind)).status).toBe("scheduled");
    expect(await renderQuiz()).toContain("This quiz is not open yet.");
    withAssignments([{ ...lesson, closes_at: iso(-HOUR) }]);
    expect((await getLewisQuizAccess(kind)).status).toBe("closed");
    expect(await renderQuiz()).toContain("This quiz is closed.");
    expect(mocks.listQuestions).not.toHaveBeenCalled();
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
    expect(await renderQuiz()).toContain("This quiz is closed.");
    expect(mocks.listQuestions).not.toHaveBeenCalled();
  });

  it("offers the quiz from its lesson page", async () => {
    withAssignments([lesson]);
    const html = await renderAssignment(lesson.id);
    expect(html).toContain(title);
    expect(html).toContain(`href="${path}?assignmentId=${lesson.id}"`);
    expect(html).toContain("Start quiz");
  });
});

describe("Lewis quiz assignment routing", () => {
  it("opens the quiz for the lesson it was started from", async () => {
    withAssignments([covalentLesson]);
    expect(await getLewisQuizAccess("covalent", covalentLesson.id)).toEqual({ status: "available", assignment: covalentLesson });
    expect(mocks.gate).toHaveBeenCalledWith(covalentLesson.id);
  });

  it("treats another quiz's lesson or a foreign id as missing", async () => {
    withAssignments([covalentLesson, ionicLesson, diagram]);
    expect(await getLewisQuizAccess("covalent", ionicLesson.id)).toEqual({ status: "missing" });
    expect(await getLewisQuizAccess("covalent", diagram.id)).toEqual({ status: "missing" });
    expect(await getLewisQuizAccess("ionic", "other-class-assignment")).toEqual({ status: "missing" });
    const html = renderToStaticMarkup(await LewisQuizPage({ kind: "covalent", assignmentId: ionicLesson.id }));
    expect(html).toContain("This assignment is unavailable.");
    expect(html).toContain('href="/student"');
    expect(mocks.listQuestions).not.toHaveBeenCalled();
  });

  it("blocks the quiz until earlier sections are finished", async () => {
    const blocker = assignmentOf("lewis_diagram");
    withAssignments([diagram, covalentLesson]);
    mocks.gate.mockResolvedValue({ status: "locked", blocker });
    expect(await getLewisQuizAccess("covalent", covalentLesson.id))
      .toEqual({ status: "blocked", assignment: covalentLesson, blocker });
    const html = renderToStaticMarkup(await LewisQuizPage({ kind: "covalent", assignmentId: covalentLesson.id }));
    expect(html).toContain("This section is locked.");
    expect(html).toContain(`href="/student/assignments/${blocker.id}"`);
    expect(html).not.toContain("Started ");
    expect(mocks.listQuestions).not.toHaveBeenCalled();
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
    expect(await renderQuizFor(closed)).toContain("This quiz is closed.");
    expect(await renderQuizFor(open)).toContain("Started ");
  });

  it("shows no quiz cards on the Lewis dot diagram page", async () => {
    withAssignments([diagram, covalentLesson, ionicLesson]);
    mocks.attempts.mockResolvedValue([{
      id: "exploration", attempt_number: 1, quiz_key: null, status: "in_progress",
      started_at: "2026-10-24T10:00:00Z", completed_at: null,
    }]);
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
