import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTIVITY_REGISTRY, canAssignActivity, getActivityDefinition, getNewAssignmentBlockReason } from "@/lib/activities/registry";
import { hasActivityContent } from "@/lib/assignments/activity-content";
import { LEWIS_QUIZZES, lewisQuizForLesson } from "@/lib/assignments/lewis-quizzes";
import type { ActivityType } from "@/lib/db/activities";

const entries = Object.entries(ACTIVITY_REGISTRY);

describe("shared activity support contract", () => {
  it("enables only deliverable Lewis and cylinder explorations for new assignments", () => {
    expect(entries.filter(([type]) => canAssignActivity(type)).map(([type]) => type)).toEqual([
      "lewis_diagram", "lewis_structures_covalent", "lewis_structures_ionic", "measurement_graduated_cylinder",
    ]);
    for (const [type, definition] of entries) {
      expect(definition.title).not.toBe("");
      expect(definition.description).not.toBe("");
      expect(hasActivityContent(type)).toBe(Boolean(definition.explorer));
      if (canAssignActivity(type)) {
        expect(definition.explorer).not.toBeNull();
        expect(getNewAssignmentBlockReason(type)).toBeNull();
        expect(definition.showInCatalog).toBe(true);
      } else {
        expect(getNewAssignmentBlockReason(type)).toBeTruthy();
      }
    }
  });

  it("does not revoke existing ruler content/participation while new assignments are paused", () => {
    for (const type of ["measurement_ruler_tenths", "measurement_ruler_hundredths"]) {
      expect(hasActivityContent(type)).toBe(true);
      expect(canAssignActivity(type)).toBe(false);
    }
    expect(getActivityDefinition("measurement_ruler_hundredths")?.showInCatalog).toBe(false);
  });

  it("keeps every advertised practice location tied to a real route", () => {
    for (const [, definition] of entries) {
      if (definition.practicePath) {
        expect(existsSync(resolve(process.cwd(), "src/app/(student)", definition.practicePath.slice(1), "page.tsx"))).toBe(true);
      }
    }
  });

  it("uses registry quiz associations consistently with existing Lewis routes", () => {
    for (const [type, definition] of entries) {
      const kind = lewisQuizForLesson(type as ActivityType);
      if (definition.quiz === "covalent" || definition.quiz === "ionic") {
        expect(kind).toBe(definition.quiz);
        expect(LEWIS_QUIZZES[definition.quiz].lessonType).toBe(type);
      } else expect(kind).toBeNull();
    }
  });

  it.each(["future_activity", "constructor", "toString", "__proto__", ""])("fails closed for %s", (type) => {
    expect(getActivityDefinition(type)).toBeNull();
    expect(canAssignActivity(type)).toBe(false);
    expect(hasActivityContent(type)).toBe(false);
    expect(getNewAssignmentBlockReason(type)).toBe("This activity is not supported for new assignments.");
  });
});
