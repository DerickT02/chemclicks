import { describe, expect, it } from "vitest";
import { ACTIVITY_REGISTRY, canAssignActivity, getActivityDefinition, getNewAssignmentBlockReason } from "@/lib/activities/registry";
import { hasActivityContent } from "@/lib/assignments/activity-content";

const entries = Object.entries(ACTIVITY_REGISTRY);

describe("shared activity support contract", () => {
  it("gives every catalog activity an assignable exploration", () => {
    expect(entries.map(([type]) => type)).toEqual([
      "bohr_model_intro", "bohr_model_stability", "lewis_diagram", "lewis_structures_covalent", "lewis_structures_ionic",
      "measurement_ruler_tenths", "measurement_ruler_hundredths",
      "measurement_graduated_cylinder_whole", "measurement_graduated_cylinder",
    ]);
    for (const [type, definition] of entries) {
      expect(definition.description).not.toBe("");
      expect(hasActivityContent(type)).toBe(true);
      expect(canAssignActivity(type)).toBe(true);
      expect(getNewAssignmentBlockReason(type)).toBeNull();
    }
  });

  it("offers both ruler precisions as assignable explorations", () => {
    for (const type of ["measurement_ruler_tenths", "measurement_ruler_hundredths"]) {
      expect(hasActivityContent(type)).toBe(true);
      expect(canAssignActivity(type)).toBe(true);
    }
  });

  it("offers both graduated cylinder precisions as assignable explorations", () => {
    for (const type of ["measurement_graduated_cylinder_whole", "measurement_graduated_cylinder"]) {
      expect(getActivityDefinition(type)?.explorer).toBe("cylinder");
      expect(canAssignActivity(type)).toBe(true);
    }
  });

  it.each(["future_activity", "constructor", "toString", "__proto__", ""])("fails closed for %s", (type) => {
    expect(getActivityDefinition(type)).toBeNull();
    expect(canAssignActivity(type)).toBe(false);
    expect(hasActivityContent(type)).toBe(false);
    expect(getNewAssignmentBlockReason(type)).toBe("This activity is not supported for new assignments.");
  });
});
