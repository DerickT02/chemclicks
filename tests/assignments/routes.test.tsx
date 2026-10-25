import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement } from "react";
import type { StudentAssignment } from "@/lib/db/student-assignments";
import AssignmentAccess from "@/components/assignments/AssignmentAccess";
const attempts = vi.hoisted(() => vi.fn());
vi.mock('@/lib/server/student-assignments', () => ({ getAssignmentAttempts: attempts }));
vi.mock('@/app/(student)/student/assignments/[assignmentId]/AttemptControls', () => ({ default: ({ attemptId, completed }: { attemptId?: string; completed: boolean }) => <button>{!attemptId ? 'Start exploration' : completed ? 'Start a new exploration' : 'Finish exploration'}</button> }));
const reader = vi.hoisted(() => vi.fn());
const gate = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/assignments/prerequisites", () => ({ getAssignmentGate: gate }));
vi.mock("@/lib/db/student-assignments", () => ({ getStudentAssignments: reader, getStudentAssignmentSchedules: reader }));
vi.mock("@/lib/server/student-work-queue", () => ({ getStudentWorkQueue: async () => {
  const result = await reader();
  return result.status === "ok" ? {
    ...result, context: { studentName: "Alex Student", className: "Chemistry", section: "A" },
    checkedAt: Date.now(), progressError: null,
    assignments: result.assignments.map((row: StudentAssignment) => ({ ...row, progress: "not_started" })),
  } : result;
} }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));
vi.mock("@/components/assignments/AssignmentAccess", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/bohr-models/BohrModelViewer", () => ({ default: () => <p>Bohr exercise</p> }));
vi.mock("@/components/measurement/GraduatedCylinder", () => ({ default: () => <p>Cylinder exercise</p> }));
vi.mock("@/components/measurement/PrecisionRuler", () => ({ default: ({ precision }: { precision: string }) => <p>Ruler exercise: {precision}</p> }));
vi.mock("@/components/lewis/LewisDotExplorer", () => ({ default: () => <p>Lewis exercise</p> }));
vi.mock("@/components/lewis/IonicCompoundExplorer", () => ({ default: () => <p>Ionic exercise</p> }));
vi.mock("@/components/lewis/CovalentBondExplorer", () => ({ default: () => <p>Covalent exercise</p> }));
import AssignmentPage from "@/app/(student)/student/assignments/[assignmentId]/page";
import StudentPage from "@/app/(student)/student/page";
import { getNewAssignmentBlockReason } from "@/lib/activities/registry";

const assignment = {
  id: "assignment-a", opens_at: null, closes_at: null,
  activity: { id: "activity-a", title: "Cylinder", type: "measurement_graduated_cylinder", order_index: 1 },
};
const openGate = { status: "open", entry: { complete: false }, next: null };
beforeEach(() => {
  reader.mockReset(); attempts.mockReset().mockResolvedValue([]);
  gate.mockReset().mockResolvedValue(openGate);
});
const page = (id = assignment.id) => AssignmentPage({ params: Promise.resolve({ assignmentId: id }) });

describe("student assignment pages", () => {
  it("redirects unauthenticated requests", async () => {
    reader.mockResolvedValue({ status: "unauthenticated" });
    await expect(page()).rejects.toThrow("REDIRECT:/login/student");
    await expect(StudentPage()).rejects.toThrow("REDIRECT:/login/student");
  });
  it("does not render unavailable or other-class assignment IDs", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [assignment] });
    await expect(page("other-assignment")).rejects.toThrow("NOT_FOUND");
  });
  it("keys the exploration boundary by assignment identity, not a changing deadline", async () => {
    const boundary = async () => {
      const tree = await page();
      const children: unknown[] = tree.props.children.props.children;
      const node = children.find(child => isValidElement(child) && child.type === AssignmentAccess);
      if (!isValidElement<{ closesAt: string | null }>(node)) throw new Error("Missing assignment boundary");
      return node;
    };
    reader.mockResolvedValue({ status: "ok", assignments: [assignment] });
    const initial = await boundary();
    reader.mockResolvedValue({ status: "ok", assignments: [{ ...assignment, closes_at: "2030-01-01T12:00:00Z" }] });
    const updated = await boundary();
    expect(initial.key).toBe(assignment.id);
    expect(updated.key).toBe(initial.key);
    expect(updated.props.closesAt).toBe("2030-01-01T12:00:00Z");
  });
  it("places Start before the exercise and collapses saved history afterward", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [assignment] });
    const html = renderToStaticMarkup(await page());
    expect(html.indexOf("Start exploration</button>")).toBeLessThan(html.indexOf("Cylinder exercise"));
    expect(html.indexOf("Saved exploration history")).toBeGreaterThan(html.indexOf("Cylinder exercise"));
    expect(html).toContain("<details");
    expect(html).toContain("Opening the page alone does not save completion");
  });
  it("places Finish after the exercise and confirms existing saved completion without automatically retrying", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [assignment] });
    const record = { id: "attempt", attempt_number: 1, status: "in_progress", started_at: "2026-01-01T00:00Z", completed_at: null };
    attempts.mockResolvedValue([record]);
    let html = renderToStaticMarkup(await page());
    expect(html.indexOf("Finish exploration</button>")).toBeGreaterThan(html.indexOf("Cylinder exercise"));
    attempts.mockResolvedValue([{ ...record, status: "completed", completed_at: "2026-01-01T01:00Z" }]);
    html = renderToStaticMarkup(await page());
    expect(html).toContain("Completion saved.");
    expect(html).toContain("Start a new exploration");
    expect(html).not.toContain("Finish exploration</button>");
  });
  it("redirects closed work to read-only history and does not expose future exercises", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [{ ...assignment, closes_at: "2000-01-01T00:00Z" }] });
    await expect(page()).rejects.toThrow(`REDIRECT:/student/assignments/${assignment.id}/history`);
    reader.mockResolvedValue({ status: "ok", assignments: [{ ...assignment, opens_at: "9999-01-01T00:00Z" }] });
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("not available right now");
    expect(html).not.toContain("Cylinder exercise");
    expect(attempts).not.toHaveBeenCalled();
  });
  it("renders only the assigned exercise", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [assignment] });
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Cylinder exercise");
    expect(html).not.toContain("Ruler exercise");
    expect(html).not.toContain("Lewis exercise");
    expect(html).not.toContain("Ionic exercise");
    expect(html).not.toContain("Covalent exercise");
    expect(html).not.toContain("Bohr exercise");
  });
  it.each(["bohr_model_intro", "bohr_model_stability"])("renders the Bohr viewer for %s assignments", async (type) => {
    const bohr = { ...assignment, id: "bohr", activity: { ...assignment.activity, type } };
    reader.mockResolvedValue({ status: "ok", assignments: [bohr] });
    const html = renderToStaticMarkup(await page("bohr"));
    expect(html).toContain("Bohr exercise");
    expect(html).toContain("Start exploration");
    expect(html).toContain('href="/student/quizzes/bohr?assignmentId=bohr"');
    expect(html).not.toContain("Lewis exercise");
    expect(html).not.toContain("not available yet");
    expect(renderToStaticMarkup(await StudentPage())).toContain("/student/assignments/bohr");
  });
  it("keeps quiz attempts out of the exploration controls and history while still listing them as quiz history", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [assignment] });
    attempts.mockResolvedValue([{
      id: "quiz", attempt_number: 1, quiz_key: "measurement_cylinder_tenths", instrument: "cylinder", precision_mode: "tenths",
      status: "completed", score: 4, question_total: 5, passed: true,
      started_at: "2026-10-01T12:00:00Z", completed_at: "2026-10-01T12:05:00Z",
    }]);
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Start exploration");
    expect(html).toContain("Saved exploration history (0)");
    expect(html).toContain("4 of 5 correct");
  });
  it("shows Bohr quiz history on the originating assignment", async () => {
    const bohr = { ...assignment, id: "bohr", activity: { ...assignment.activity, type: "bohr_model_stability" } };
    reader.mockResolvedValue({ status: "ok", assignments: [bohr] });
    attempts.mockResolvedValue([{
      id: "bohr-quiz", attempt_number: 1, quiz_key: "bohr_models", instrument: null, precision_mode: null,
      status: "completed", score: 10, question_total: 12, passed: true,
      started_at: "2026-10-01T12:00:00Z", completed_at: "2026-10-01T12:05:00Z",
    }]);

    const html = renderToStaticMarkup(await AssignmentPage({ params: Promise.resolve({ assignmentId: "bohr" }) }));

    expect(html).toContain("Bohr quiz history");
    expect(html).toContain("10 of 12 correct");
    expect(html).toContain("Passed");
  });
  it("refuses a Bohr assignment the authorized reader does not return", async () => {
    // Closed, archived and other-class rows never leave getStudentAssignments.
    reader.mockResolvedValue({ status: "ok", assignments: [assignment] });
    await expect(page("bohr")).rejects.toThrow("NOT_FOUND");
    expect(renderToStaticMarkup(await StudentPage())).not.toContain("/student/assignments/bohr");
  });
  it.each(["tenths", "hundredths"])("starts the coarse-to-fine comparison for the %s ruler assignment", async (precision) => {
    reader.mockResolvedValue({ status: "ok", assignments: [{
      ...assignment, activity: { ...assignment.activity, type: `measurement_ruler_${precision}` },
    }] });
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Ruler exercise: tenths");
    expect(html).toContain("Next");
    expect(html).not.toContain("Ruler exercise: hundredths");
  });
  it("renders the ionic compound explorer for ionic assignments", async () => {
    const ionic = { ...assignment, id: "ionic", activity: { ...assignment.activity, type: "lewis_structures_ionic" } };
    reader.mockResolvedValue({ status: "ok", assignments: [ionic] });
    const html = renderToStaticMarkup(await page("ionic"));
    expect(html).toContain("Ionic exercise");
    expect(html).not.toContain("Lewis exercise");
    expect(html).not.toContain("not available yet");
    expect(renderToStaticMarkup(await StudentPage())).toContain("/student/assignments/ionic");
  });
  it("renders the covalent bond explorer for covalent assignments", async () => {
    const covalent = { ...assignment, id: "covalent", activity: { ...assignment.activity, type: "lewis_structures_covalent" } };
    reader.mockResolvedValue({ status: "ok", assignments: [covalent] });
    const html = renderToStaticMarkup(await page("covalent"));
    expect(html).toContain("Covalent exercise");
    expect(html).not.toContain("Ionic exercise");
    expect(html).not.toContain("not available yet");
    expect(renderToStaticMarkup(await StudentPage())).toContain("/student/assignments/covalent");
  });
  it("shows an empty state and handles query failures separately", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [] });
    expect(renderToStaticMarkup(await StudentPage())).toContain("Your teacher has not assigned any activities yet");
    reader.mockResolvedValue({ status: "error", message: "Unable to load" });
    expect(renderToStaticMarkup(await StudentPage())).toContain('role="alert"');
    await expect(page()).rejects.toThrow("Unable to load");
  });
  it("links implemented assignments and labels missing exercise content", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [assignment, {
      ...assignment, id: "future", activity: { ...assignment.activity, type: "future_activity" },
    }] });
    const html = renderToStaticMarkup(await StudentPage());
    expect(html).toContain(`/student/assignments/${assignment.id}`);
    expect(html).not.toContain("/student/assignments/future");
    expect(html).toContain("Exercise not available yet");
  });
  it("explains work of an unrecognised type without attempt controls", async () => {
    const type = "future_activity";
    reader.mockResolvedValue({ status: "ok", assignments: [{
      ...assignment, id: "unsupported", activity: { ...assignment.activity, title: "Future activity", type },
    }] });
    const html = renderToStaticMarkup(await page("unsupported"));
    expect(html).toContain("This activity’s exercise is not available yet.");
    expect(html).toContain(getNewAssignmentBlockReason(type));
    expect(html).not.toContain("Start exploration");
    expect(html).not.toContain("Exploration attempts");
  });

  it.each([
    ["lewis_structures_covalent", "/student/quizzes/covalent"],
    ["lewis_structures_ionic", "/student/quizzes/ionic"],
    ["bohr_model_intro", "/student/quizzes/bohr"],
  ])("shows a Take quiz link on %s assignments that names the assignment", async (type, path) => {
    reader.mockResolvedValue({ status: "ok", assignments: [{
      ...assignment, id: "lesson", activity: { ...assignment.activity, type },
    }] });
    const html = renderToStaticMarkup(await StudentPage());
    expect(html).toContain("Take quiz");
    expect(html).toContain(`href="${path}?assignmentId=lesson"`);
  });
  it("shows no Take quiz link on other activities", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [assignment, {
      ...assignment, id: "diagram", activity: { ...assignment.activity, type: "lewis_diagram" },
    }] });
    const html = renderToStaticMarkup(await StudentPage());
    expect(html).not.toContain("Take quiz");
    expect(html).not.toContain("/student/quizzes/");
  });
});

describe("prerequisite gating", () => {
  const blocker = { ...assignment, id: "bohr-intro", activity: { ...assignment.activity, id: "bohr", title: "Bohr Intro", type: "bohr_model_intro" } };

  it("shows a locked panel instead of the exercise when an earlier section is unfinished", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [assignment] });
    gate.mockResolvedValue({ status: "locked", blocker });
    const html = renderToStaticMarkup(await page());
    expect(gate).toHaveBeenCalledWith(assignment.id);
    expect(html).toContain("This section is locked.");
    expect(html).toContain('href="/student/assignments/bohr-intro"');
    expect(html).toContain('href="/student"');
    expect(html).not.toContain("Cylinder exercise");
    expect(html).not.toContain("Start exploration");
    expect(attempts).not.toHaveBeenCalled();
  });
  it("sends a signed-out gate result to the student login", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [assignment] });
    gate.mockResolvedValue({ status: "unauthenticated" });
    await expect(page()).rejects.toThrow("REDIRECT:/login/student");
  });
  it("links a completed section to the next unlocked one", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [assignment] });
    gate.mockResolvedValue({ status: "open", entry: { complete: true }, next: { assignment: blocker } });
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Continue to Bohr Intro");
    expect(html).toContain('href="/student/assignments/bohr-intro"');
  });
  it("points back to the queue when no open section is left", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [assignment] });
    gate.mockResolvedValue({ status: "open", entry: { complete: true }, next: null });
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("finished all open sections");
    expect(html).toContain('href="/student"');
  });
  it("hides start and quiz links on locked queue cards and names the blocking section", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [{
      ...assignment, id: "lesson", activity: { ...assignment.activity, type: "lewis_structures_covalent" },
      lockedBy: { id: "bohr-intro", activity: { title: "Bohr Intro" } },
    }] });
    const html = renderToStaticMarkup(await StudentPage());
    expect(html).toContain("Locked: finish");
    expect(html).toContain('href="/student/assignments/bohr-intro"');
    expect(html).not.toContain('href="/student/assignments/lesson"');
    expect(html).not.toContain("Take quiz");
  });
});
