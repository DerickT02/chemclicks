import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getMeasurementQuizMode, type MeasurementQuizModeKey } from "@/lib/measurement/modes";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20261020000000_measurement_ruler_tenths_tolerance.sql",
      import.meta.url,
    ),
  ),
  "utf8",
)
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("measurement ruler tenths tolerance migration", () => {
  it.each<MeasurementQuizModeKey>(["ruler_tenths", "ruler_hundredths", "cylinder_tenths"])(
    "grades %s on the server at the client's tolerance",
    (mode) => {
      const { tolerance } = getMeasurementQuizMode(mode).spec;
      expect(migration).toContain(`when '${mode}' then ${tolerance}`);
    },
  );

  it("keeps the archive check and the 0–10 cm ruler answer bound", () => {
    expect(migration).toContain("and ca.archived_at is null");
    expect(migration).toContain("else 10 end");
  });

  it("still records only the first gradable answer", () => {
    expect(migration).toContain("if v_existing_answer is null and v_gradable then");
  });
});
