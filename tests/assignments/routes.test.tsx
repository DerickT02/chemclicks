import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const reader = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/student-assignments", () => ({ getStudentAssignments: reader }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));
vi.mock("@/components/assignments/AssignmentAccess", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/measurement/GraduatedCylinder", () => ({ default: () => <p>Cylinder exercise</p> }));
vi.mock("@/components/measurement/PrecisionRuler", () => ({ default: () => <p>Ruler exercise</p> }));
vi.mock("@/components/lewis/LewisDotExplorer", () => ({ default: () => <p>Lewis exercise</p> }));
vi.mock("@/components/lewis/IonicCompoundExplorer", () => ({ default: () => <p>Ionic exercise</p> }));
import AssignmentPage from "@/app/(student)/student/assignments/[assignmentId]/page";
import StudentPage from "@/app/(student)/student/page";

const assignment = {
  id: "assignment-a", opens_at: null, closes_at: null,
  activity: { id: "activity-a", title: "Cylinder", type: "measurement_graduated_cylinder", order_index: 1 },
};
beforeEach(() => reader.mockReset());
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
  it("renders only the assigned exercise", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [assignment] });
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Cylinder exercise");
    expect(html).not.toContain("Ruler exercise");
    expect(html).not.toContain("Lewis exercise");
    expect(html).not.toContain("Ionic exercise");
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
  it("shows an empty state and handles query failures separately", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [] });
    expect(renderToStaticMarkup(await StudentPage())).toContain("No activities are available");
    reader.mockResolvedValue({ status: "error", message: "Unable to load" });
    expect(renderToStaticMarkup(await StudentPage())).toContain('role="alert"');
    await expect(page()).rejects.toThrow("Unable to load");
  });
  it("links implemented assignments and labels missing exercise content", async () => {
    reader.mockResolvedValue({ status: "ok", assignments: [assignment, {
      ...assignment, id: "bohr", activity: { ...assignment.activity, type: "bohr_model_intro" },
    }] });
    const html = renderToStaticMarkup(await StudentPage());
    expect(html).toContain(`/student/assignments/${assignment.id}`);
    expect(html).not.toContain("/student/assignments/bohr");
    expect(html).toContain("Exercise not available yet");
  });
});
