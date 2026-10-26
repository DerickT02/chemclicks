import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ schedules: vi.fn(), attempts: vi.fn(), gate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/assignments/prerequisites", () => ({ getAssignmentGate: mocks.gate }));
vi.mock("@/lib/db/student-assignments", () => ({ getStudentAssignmentSchedules: mocks.schedules }));
vi.mock("@/lib/server/student-assignments", () => ({ getAssignmentAttempts: mocks.attempts }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
import HistoryPage from "@/app/(student)/student/assignments/[assignmentId]/history/page";

const assignment = { id: "own", opens_at: null, closes_at: "2000-01-01T00:00Z", activity: { id: "a", title: "Lewis", type: "lewis_diagram", order_index: 1 } };
const page = () => HistoryPage({ params: Promise.resolve({ assignmentId: "own" }) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.schedules.mockResolvedValue({ status: "ok", assignments: [assignment] });
  mocks.attempts.mockResolvedValue([{ id: "attempt", attempt_number: 1, status: "completed", started_at: "1999-12-01T00:00Z", completed_at: "1999-12-02T00:00Z" }]);
});

describe("read-only saved exploration history", () => {
  it("shows confirmed own completion after closing without interactive exercise/submission controls", async () => {
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Exploration completion saved");
    expect(html).toContain("No further work can be submitted");
    expect(html).toContain("Attempt 1: Completed");
    expect(html).toContain("<details");
    expect(html).not.toMatch(/<form|<button|Start exploration|Finish exploration|Take quiz|Back to activity/);
    expect(mocks.attempts).toHaveBeenCalledWith("own");
  });
  it("does not fabricate completion for an unfinished attempt or no saved attempts", async () => {
    mocks.attempts.mockResolvedValue([]);
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("No exploration completion has been saved");
    expect(html).toContain("No exploration attempts have been saved");
    expect(html).not.toContain("Exploration completion saved.");
  });
  it.each(["9999-01-01T00:00Z", "invalid"])("does not read saved attempts before an opening/valid schedule (%s)", async opens_at => {
    mocks.schedules.mockResolvedValue({ status: "ok", assignments: [{ ...assignment, opens_at, closes_at: null }] });
    expect(renderToStaticMarkup(await page())).toContain("Saved history is unavailable");
    expect(mocks.attempts).not.toHaveBeenCalled();
  });
  it("rejects foreign IDs, missing/inactive membership, and load failures before reading attempts", async () => {
    mocks.schedules.mockResolvedValue({ status: "ok", assignments: [] });
    await expect(page()).rejects.toThrow("NOT_FOUND");
    mocks.schedules.mockResolvedValue({ status: "unauthenticated" });
    await expect(page()).rejects.toThrow("REDIRECT:/login/student");
    mocks.schedules.mockResolvedValue({ status: "error", message: "Unavailable" });
    await expect(page()).rejects.toThrow("Unavailable");
    expect(mocks.attempts).not.toHaveBeenCalled();
  });
  it("keeps closed history reviewable without checking prerequisites", async () => {
    renderToStaticMarkup(await page());
    expect(mocks.gate).not.toHaveBeenCalled();
  });
  it("locks an open section's history behind its prerequisites", async () => {
    mocks.schedules.mockResolvedValue({ status: "ok", assignments: [{ ...assignment, opens_at: null, closes_at: null }] });
    mocks.gate.mockResolvedValue({ status: "locked", blocker: { ...assignment, id: "first", activity: { ...assignment.activity, title: "Bohr Intro" } } });
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("This section is locked.");
    expect(html).toContain('href="/student/assignments/first"');
    expect(mocks.attempts).not.toHaveBeenCalled();
  });
});
