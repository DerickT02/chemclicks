import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { groupWorkQueue, queueSection, type QueueAssignment } from "@/lib/assignments/work-queue";
import type { StudentWorkQueueResult } from "@/lib/server/student-work-queue";

const reader = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/student-work-queue", () => ({ getStudentWorkQueue: reader }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("@/components/assignments/RefreshAssignments", () => ({ default: () => <button>Refresh assignments</button> }));
import StudentPage from "@/app/(student)/student/page";

const now = Date.parse("2026-04-01T12:00:00Z");
const assignment = (id: string, overrides: Partial<QueueAssignment> = {}): QueueAssignment => ({
  id, opens_at: null, closes_at: null, progress: "not_started",
  activity: { id: `activity-${id}`, title: `Activity ${id}`, type: "lewis_structures_covalent", order_index: 1 },
  ...overrides,
});
function response(assignments: QueueAssignment[], progressError: string | null = null): StudentWorkQueueResult {
  return { status: "ok", assignments, checkedAt: now, progressError,
    context: { studentName: "Alex Student", className: "Chemistry", section: "Period A" } };
}
beforeEach(() => reader.mockReset());
const html = async () => renderToStaticMarkup(await StudentPage());

describe("work queue grouping", () => {
  it.each([
    ["not_started", {}, "not_started"], ["in_progress", {}, "in_progress"], ["completed", {}, "completed"],
    [null, {}, "unknown"], ["completed", { opens_at: "2026-04-02T00:00:00Z" }, "upcoming"],
    ["completed", { closes_at: "2026-04-01T12:00:00Z" }, "closed"],
    ["not_started", { opens_at: "2026-04-01T12:00:00Z" }, "not_started"],
    ["completed", { closes_at: "invalid" }, "invalid"],
    ["completed", { opens_at: "2026-04-02T12:00:00Z", closes_at: "2026-04-01T12:00:00Z" }, "invalid"],
  ] as const)("maps %s with %j to %s using availability before progress", (progress, dates, expected) => {
    expect(queueSection(assignment("a", { progress, ...dates }), now)).toBe(expected);
  });
  it("prioritizes resuming work and sorts available deadlines and upcoming openings deterministically", () => {
    const rows = [assignment("b"), assignment("a"),
      assignment("deadline", { closes_at: "2026-04-01T13:00:00Z" }),
      assignment("resume", { progress: "in_progress" }),
      assignment("later", { opens_at: "2026-04-03T12:00:00Z" }),
      assignment("sooner", { opens_at: "2026-04-02T12:00:00Z" }),
    ];
    const groups = groupWorkQueue(rows, now);
    expect(groups.map(group => group.id)).toEqual(["in_progress", "not_started", "upcoming"]);
    expect(groups[1].assignments.map(row => row.id)).toEqual(["deadline", "a", "b"]);
    expect(groups[2].assignments.map(row => row.id)).toEqual(["sooner", "later"]);
    expect(rows[0].id).toBe("b"); // Never mutate server input ordering.
  });
});

describe("student dashboard work queue", () => {
  it("shows scoped student/class context, persisted states, next actions and explicit tracking/quiz distinctions", async () => {
    reader.mockResolvedValue(response([assignment("todo"), assignment("resume", { progress: "in_progress" }),
      assignment("review", { progress: "completed" })]));
    const output = await html();
    expect(output).toContain("Alex Student · Chemistry");
    expect(output).toContain("Period A");
    for (const text of ["To do (1)", "In progress (1)", "Completed explorations (1)", "Open to start",
      "Resume exploration", "Review exploration", "Exploration completion saved", "This is not a quiz grade",
      "Use Start exploration inside an activity to track your work", "Quiz answers and results are not saved or visible to your teacher",
      "Explore untracked practice", "Refresh assignments"]) expect(output).toContain(text);
    for (const id of ["todo", "resume", "review"]) expect(output).toContain(`href="/student/assignments/${id}"`);
  });

  it("shows closed history links but no future exercises, quiz links or inferred completion", async () => {
    reader.mockResolvedValue(response([
      assignment("future", { opens_at: "2026-04-02T12:00:00Z", progress: "completed" }),
      assignment("closed", { closes_at: "2026-04-01T12:00:00Z", progress: "completed" }),
    ]));
    const output = await html();
    expect(output).toContain("Upcoming (1)");
    expect(output).toContain("Closed (1)");
    expect(output).toContain("No activities are available right now");
    expect(output).toContain("Not open yet");
    expect(output).toContain("You can still view your saved exploration history");
    expect(output).toContain('href="/student/assignments/closed/history"');
    expect(output).toContain('dateTime="2026-04-02T12:00:00Z"');
    expect(output).not.toContain("Completed explorations");
    expect(output).not.toContain("Exploration completion saved");
    expect(output).not.toContain('href="/student/assignments/future');
    expect(output).not.toContain('href="/student/quizzes/');
    expect(output).not.toContain("Take quiz");
  });

  it("distinguishes an unassigned class from future/closed work and provides recovery/practice", async () => {
    reader.mockResolvedValue(response([]));
    const output = await html();
    expect(output).toContain("Your teacher has not assigned any activities yet");
    expect(output).toContain("refresh assignments");
    expect(output).toContain('href="/student/labs"');
    expect(output).not.toContain("No activities are available right now");
  });

  it("does not invent to-do counts or completion on progress failure", async () => {
    reader.mockResolvedValue(response([assignment("unknown", { progress: null })], "Progress could not be loaded."));
    const output = await html();
    expect(output).toContain('role="alert"');
    expect(output).toContain("Available — progress unavailable (1)");
    expect(output).toContain("Open activity");
    expect(output).not.toContain("To do (1)");
    expect(output).not.toContain("Exploration not started");
    expect(output).not.toContain("Your available explorations are completed");
  });

  it("shows unavailable data without a false empty class or enrollment context", async () => {
    reader.mockResolvedValue({ status: "error", message: "Your assignments could not be loaded. Please try again." });
    const output = await html();
    expect(output).toContain('role="alert"');
    expect(output).not.toContain("not assigned any activities");
    expect(output).not.toContain("Alex Student");
    expect(output).toContain("Refresh assignments");
  });

  it("does not offer exercise access for unsupported types or invalid schedules", async () => {
    reader.mockResolvedValue(response([
      assignment("bohr", { activity: { id: "bohr", title: "Bohr", type: "bohr_model_intro", order_index: 1 } }),
      assignment("invalid", { closes_at: "bad" }),
    ]));
    const output = await html();
    expect(output).toContain("Exercise unavailable (1)");
    expect(output).toContain("Exercise not available yet");
    expect(output).toContain("Schedule unavailable (1)");
    expect(output).not.toContain('href="/student/assignments/');
    expect(output).not.toContain("Take quiz");
  });

  it("offers review for completed open explorations without claiming future work or quizzes are complete", async () => {
    reader.mockResolvedValue(response([assignment("review", { progress: "completed" }),
      assignment("future", { opens_at: "2026-04-02T12:00:00Z" })]));
    const output = await html();
    expect(output).toContain("Your available explorations are completed");
    expect(output).toContain("review them while they remain open");
    expect(output).toContain("Upcoming (1)");
    expect(output).not.toContain("All assignments completed");
  });

  it("redirects missing or inactive membership before showing any class details", async () => {
    reader.mockResolvedValue({ status: "unauthenticated" });
    await expect(StudentPage()).rejects.toThrow("REDIRECT:/login/student");
  });
});
