import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const assignmentsReader = vi.hoisted(() => vi.fn());
const sectionAccess = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/student-assignments", () => ({
  getStudentAssignmentSchedules: assignmentsReader,
}));
vi.mock("@/lib/assignments/prerequisites", () => ({ getSectionAccess: sectionAccess }));

import { findBohrQuizAssignment, getBohrQuizAccess } from "@/lib/assignments/bohr-quiz-access";
import type { StudentAssignment } from "@/lib/db/student-assignments";

function assignment(type: StudentAssignment["activity"]["type"], id: string): StudentAssignment {
  return {
    id,
    opens_at: null,
    closes_at: null,
    activity: { id: `activity-${id}`, title: type, type, order_index: 1 },
  };
}

describe("Bohr quiz access", () => {
  beforeEach(() => {
    assignmentsReader.mockReset();
    sectionAccess.mockReset().mockImplementation(async (assignment: StudentAssignment) => ({ status: "available", assignment }));
  });

  it("uses the sole available Bohr lesson as the quiz assignment", () => {
    expect(findBohrQuizAssignment([
      assignment("lewis_diagram", "lewis"),
      assignment("bohr_model_stability", "bohr"),
    ])?.id).toBe("bohr");
  });

  it("does not select arbitrarily when multiple Bohr lessons are available", () => {
    expect(findBohrQuizAssignment([
      assignment("bohr_model_intro", "intro"),
      assignment("bohr_model_stability", "stability"),
    ])).toBeNull();
  });

  it("stays locked when no Bohr lesson is assigned", () => {
    expect(findBohrQuizAssignment([
      assignment("lewis_diagram", "lewis"),
    ])).toBeNull();
  });

  it("stays locked outside the assignment availability window", () => {
    expect(findBohrQuizAssignment([
      {
        ...assignment("bohr_model_intro", "bohr"),
        opens_at: "2026-10-08T00:00:00Z",
      },
    ], Date.parse("2026-10-07T00:00:00Z"))).toBeNull();
  });

  it("honors an explicit assignment instead of selecting the first available lesson", async () => {
    const intro = assignment("bohr_model_intro", "intro");
    const stability = assignment("bohr_model_stability", "stability");
    assignmentsReader.mockResolvedValue({ status: "ok", assignments: [intro, stability] });

    const access = await getBohrQuizAccess("stability");

    expect(access.status).toBe("available");
    expect(access.status === "available" && access.assignment.id).toBe("stability");
  });

  it("requires a choice when generic entry has multiple Bohr assignments", async () => {
    const intro = assignment("bohr_model_intro", "intro");
    const stability = assignment("bohr_model_stability", "stability");
    assignmentsReader.mockResolvedValue({ status: "ok", assignments: [intro, stability] });

    const access = await getBohrQuizAccess();

    expect(access).toEqual({ status: "selection", assignments: [intro, stability] });
  });

  it("reports an explicit assignment that is not authorized as missing", async () => {
    assignmentsReader.mockResolvedValue({
      status: "ok",
      assignments: [assignment("bohr_model_intro", "intro")],
    });

    await expect(getBohrQuizAccess("another-assignment"))
      .resolves.toEqual({ status: "missing" });
    expect(sectionAccess).not.toHaveBeenCalled();
  });

  it("passes the chosen lesson through the prerequisite gate", async () => {
    const lewis = assignment("lewis_diagram", "lewis");
    const stability = assignment("bohr_model_stability", "stability");
    assignmentsReader.mockResolvedValue({ status: "ok", assignments: [lewis, stability] });
    sectionAccess.mockResolvedValue({ status: "blocked", assignment: stability, blocker: lewis });

    await expect(getBohrQuizAccess("stability"))
      .resolves.toEqual({ status: "blocked", assignment: stability, blocker: lewis });
    expect(sectionAccess).toHaveBeenCalledWith(stability);
  });

  it("does not offer a Lewis assignment id as a Bohr quiz", async () => {
    assignmentsReader.mockResolvedValue({ status: "ok", assignments: [assignment("lewis_diagram", "lewis")] });

    await expect(getBohrQuizAccess("lewis")).resolves.toEqual({ status: "missing" });
  });

  it("falls back to a scheduled lesson when no Bohr lesson is open yet", async () => {
    const later = { ...assignment("bohr_model_intro", "later"), opens_at: "9999-01-01T00:00:00Z" };
    assignmentsReader.mockResolvedValue({ status: "ok", assignments: [later] });

    await getBohrQuizAccess();
    expect(sectionAccess).toHaveBeenCalledWith(later);
  });
});
