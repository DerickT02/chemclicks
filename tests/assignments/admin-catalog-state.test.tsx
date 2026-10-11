import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getActivityDefinition } from "@/lib/activities/registry";

const mocks = vi.hoisted(() => ({ catalog: vi.fn(), assignments: vi.fn(), classes: vi.fn(), roster: vi.fn(), lessonProgress: vi.fn(), user: vi.fn() }));
vi.mock("@/app/admin/classes/DisableClassControl", () => ({ default: ({ classId, className }: { classId: string; className: string }) => <button data-class-id={classId}>Disable {className}</button> }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mocks.user },
  from: () => ({ select: () => ({ in: async () => ({ data: [], error: null }) }) }),
}) }));
vi.mock("@/lib/db/activities", () => ({ listActivityCatalog: mocks.catalog }));
vi.mock("@/lib/db/class_activities", () => ({ getClassActivities: mocks.assignments }));
vi.mock("@/lib/db/classes", () => ({ listActiveClassesForTeacher: mocks.classes }));
vi.mock("@/lib/db/teacher-dashboard", () => ({ getTeacherRoster: mocks.roster }));
vi.mock("@/lib/server/teacher-lesson-progress", () => ({ getTeacherClassLessonProgress: mocks.lessonProgress }));
vi.mock("@/app/admin/assignments/AssignmentForm", () => ({ default: () => <p>New assignment form</p> }));
vi.mock("@/app/admin/assignments/actions", () => ({ saveAssignment: vi.fn(), unassignActivity: vi.fn() }));
vi.mock("@/components/assignments/RefreshAssignments", () => ({ default: ({ label }: { label: string }) => <button>{label}</button> }));

import AdminPage from "@/app/admin/page";

const classId = "11111111-1111-4111-8111-111111111111";
const activity = { id: "activity", title: "Activity title", type: "lewis_diagram", order_index: 1, description: "Description", category: "Lewis" };
const assignment = { id: "assignment", class_id: classId, activity_id: activity.id, opens_at: null, closes_at: null, created_at: "2026-09-01T12:00:00Z" };
const render = async () => renderToStaticMarkup(await AdminPage({ searchParams: Promise.resolve({ classId }) }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "teacher" } }, error: null });
  mocks.roster.mockResolvedValue({ data: [], error: null });
  mocks.lessonProgress.mockResolvedValue({ classId, className: "Chemistry", students: [] });
  mocks.classes.mockResolvedValue({ data: [{ id: classId, name: "Chemistry", section: "A", class_code: "ABC123" }], error: null });
  mocks.catalog.mockResolvedValue({ data: [activity], error: null });
  mocks.assignments.mockResolvedValue({ data: [], error: null });
});

describe("teacher catalog safety states", () => {
  it("falls back to a remaining active class when a disabled class was selected", async () => {
    const remainingId = "22222222-2222-4222-8222-222222222222";
    mocks.classes.mockResolvedValue({ data: [{ id: remainingId, name: "Remaining class", section: "B", class_code: "XYZ789" }], error: null });
    const html = await render();
    expect(html).toContain(`data-class-id="${remainingId}"`);
    expect(html).not.toContain(`data-class-id="${classId}"`);
    expect(html).not.toContain("Remove class");
    expect(mocks.assignments).toHaveBeenCalledWith(expect.anything(), remainingId);
  });

  it("confirms disabling even when the last active class is gone", async () => {
    mocks.classes.mockResolvedValue({ data: [], error: null });
    const html = renderToStaticMarkup(await AdminPage({ searchParams: Promise.resolve({ classDisabled: "1" }) }));
    expect(html).toContain('role="status"');
    expect(html).toContain("Class disabled. Student access is blocked; classroom data has been kept.");
    expect(html).toContain("No active classes");
    expect(html).toContain("Create a class");
    expect(html).not.toContain("data-class-id");
    expect(html).not.toContain("New assignment form");
    expect(mocks.assignments).not.toHaveBeenCalled();
  });

  it("blocks assigning when existing assignments could not be loaded", async () => {
    mocks.assignments.mockResolvedValue({ data: null, error: { message: "private error" } });
    const html = await render();
    expect(html).toContain("Assigned activities could not be loaded");
    expect(html).not.toContain("New assignment form");
    expect(html).not.toContain("This class has no assigned activities");
  });

  it("blocks assigning when the catalog could not be loaded", async () => {
    mocks.catalog.mockResolvedValue({ data: null, error: { message: "private error" } });
    const html = await render();
    expect(html).toContain("activity catalog could not be loaded");
    expect(html).not.toContain("New assignment form");
  });

  it("keeps existing date controls available when catalog labels fail to load", async () => {
    mocks.catalog.mockResolvedValue({ data: null, error: { message: "private catalog error" } });
    mocks.assignments.mockResolvedValue({ data: [assignment], error: null });
    const html = await render();
    expect(html).toContain("Edit dates for Assigned activity");
    expect(html).not.toContain("New assignment form");
    expect(html).not.toContain("private catalog error");
  });

  it("allows the assignment form after a confirmed empty assignment-list read", async () => {
    const html = await render();
    expect(html).toContain("New assignment form");
    expect(html).toContain("This class has no assigned activities");
  });

  it.each([
    "bohr_model_intro", "bohr_model_stability",
  ])("labels existing %s assignments with their support restriction", async (type) => {
    mocks.catalog.mockResolvedValue({ data: [{ ...activity, type }], error: null });
    mocks.assignments.mockResolvedValue({ data: [assignment], error: null });
    const html = await render();
    expect(html).toContain("Activity title");
    expect(html).toContain("New assignments unavailable");
    expect(html).toContain("Edit dates for Activity title");
    expect(html).toContain("Unassign");
    expect(html).toContain(getActivityDefinition(type)?.newAssignmentBlockReason);
  });

  it("retains a useful unavailable label when an existing assignment has no catalog entry", async () => {
    mocks.catalog.mockResolvedValue({ data: [], error: null });
    mocks.assignments.mockResolvedValue({ data: [assignment], error: null });
    const html = await render();
    expect(html).toContain("Assigned activity");
    expect(html).toContain("This activity is unavailable in the current catalog");
  });
});

const student = { id: "student-one", class_id: classId, first_name: "Mina", last_name: "Chen" };
const fiveAssignments = Array.from({ length: 5 }, (_, index) => ({ ...assignment, id: `assignment-${index}`, activity_id: `activity-${index}` }));
const lessonStudent = {
  studentId: student.id, firstName: student.first_name, lastName: student.last_name, verified: true, overallPercent: 20,
  lessons: [
    { assignmentId: "assignment-0", activityId: "activity-0", activityTitle: "Lewis Diagrams", status: "completed" },
    { assignmentId: "assignment-1", activityId: "activity-1", activityTitle: "Graduated Cylinder", status: "not_started" },
  ],
};
function populateClass() {
  mocks.roster.mockResolvedValue({ data: [student], error: null });
  mocks.assignments.mockResolvedValue({ data: fiveAssignments, error: null });
  mocks.lessonProgress.mockResolvedValue({ classId, className: "Chemistry", students: [lessonStudent] });
}

describe("teacher enrollment and lesson progress", () => {
  it("lists each student's named lesson progress from the verified lesson reader", async () => {
    populateClass();
    const html = await render();
    expect(html).toContain("Student progress");
    expect(html).toContain("Mina Chen");
    expect(html).toContain("20% complete");
    expect(html).toContain("Lewis Diagrams: Completed");
    expect(html).toContain("Graduated Cylinder: Not started");
    expect(html).toContain("1 student enrolled");
    expect(html).not.toContain("Active students");
    expect(mocks.lessonProgress).toHaveBeenCalledWith(classId);
  });
  it("shows a true empty roster only after a successful read", async () => {
    const html = await render();
    expect(html).toContain("0 students enrolled");
    expect(html).toContain("No students in this class yet.");
    expect(html).not.toContain("Enrollment unavailable");
  });
  it("does not fabricate enrollment counts after a roster failure", async () => {
    populateClass();
    mocks.roster.mockResolvedValue({ data: null, error: { message: "private SQL details" } });
    const html = await render();
    expect(html).toContain("Enrollment unavailable");
    expect(html).toContain("Enrollment count unavailable");
    expect(html).not.toContain("0 students enrolled");
    expect(html).not.toContain("private SQL");
  });
  it("keeps valid enrollment but reports a lesson-progress failure instead of an empty class", async () => {
    populateClass();
    mocks.lessonProgress.mockRejectedValue(new Error("private RPC details"));
    const html = await render();
    expect(html).toContain("1 student enrolled");
    expect(html).toContain("Student progress could not be loaded");
    expect(html).not.toContain("No students in this class yet.");
    expect(html).not.toContain("% complete");
    expect(html).not.toContain("private RPC");
  });
  it("does not query a foreign class requested through the URL", async () => {
    populateClass();
    await AdminPage({ searchParams: Promise.resolve({ classId: "foreign-class" }) });
    expect(mocks.roster).toHaveBeenCalledWith(expect.anything(), [classId]);
    expect(mocks.assignments).toHaveBeenCalledWith(expect.anything(), classId);
    expect(mocks.lessonProgress).toHaveBeenCalledWith(classId);
  });
  it("does not mask a class-list failure as no active classes", async () => {
    mocks.classes.mockResolvedValue({ data: null, error: { message: "private SQL details" } });
    await expect(render()).rejects.toThrow("We couldn't load your classes. Please try again.");
    expect(mocks.roster).not.toHaveBeenCalled();
  });
  it("does not read classroom data when verified authentication returns an error", async () => {
    mocks.user.mockResolvedValue({ data: { user: { id: "teacher" } }, error: { message: "private auth details" } });
    expect(await render()).toContain("Please sign in to view your classes");
    expect(mocks.classes).not.toHaveBeenCalled();
    expect(mocks.roster).not.toHaveBeenCalled();
  });
});
