import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../supabase/migrations/20261104000000_fix_bohr_chemistry_content.sql",
      import.meta.url,
    ),
  ),
  "utf8",
)
  // Ignore the header comment so the transaction check sees the first statement.
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ").trim().toLowerCase();

describe("Bohr chemistry content fix migration", () => {
  it("uses chloride terminology", () => {
    expect(migration).toContain("a chloride ion has 17 protons");
    expect(migration).toContain("bohr-stability-chloride-count");
  });

  it("keeps the silicon charge question consistent with the simplified silicide example", () => {
    expect(migration).toContain("14 protons and 18 electrons");
    expect(migration).toContain("bohr-stability-silicon-charge");
    expect(migration).toContain("correct_index = 1");
  });

  it("is transactional and only updates the targeted stability questions", () => {
    expect(migration).toMatch(/^begin;/);
    expect(migration).toMatch(/commit;$/);
    expect(migration).not.toMatch(/delete\s+from/);
    expect(migration).toContain("quiz_key = 'bohr_model_stability'");
  });
});
