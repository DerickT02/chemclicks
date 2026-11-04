import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../supabase/migrations/20261103010000_expand_bohr_quiz_pools.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\s+/g, " ").trim().toLowerCase();

describe("Bohr quiz pool expansion migration", () => {
  it("fills the Introduction pool from the complete 36-question legacy bank", () => {
    expect(migration).toContain("'bohr_model_intro'");
    expect(migration).toContain("'intro-' || question_key");
    expect(migration).toContain("from public.quiz_questions where quiz_key = 'bohr_models'");
    expect(migration).toContain("on conflict (quiz_key, question_key) do nothing");
  });

  it("adds Stability questions through order 36", () => {
    expect(migration).toContain("'bohr-stability-neutral-oxygen'");
    expect(migration).toContain("'bohr-stability-silicon-charge'");
    expect(migration).toContain(", 36) on conflict");
    expect(migration).toContain("noble-gas count");
    expect(migration).toContain("protons minus electrons");
  });

  it("is rerunnable and does not remove existing questions", () => {
    expect(migration).toContain("begin;");
    expect(migration).toMatch(/commit;$/);
    expect(migration).not.toMatch(/delete\s+from/);
    expect(migration).not.toMatch(/update\s+public\.quiz_questions/);
  });
});
