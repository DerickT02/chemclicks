import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { findBohrQuizAssignment } from "@/lib/assignments/bohr-quiz-access";
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
  it("uses an assigned Bohr lesson as the quiz assignment", () => {
    expect(findBohrQuizAssignment([
      assignment("lewis_diagram", "lewis"),
      assignment("bohr_model_stability", "bohr"),
    ])?.id).toBe("bohr");
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
});
