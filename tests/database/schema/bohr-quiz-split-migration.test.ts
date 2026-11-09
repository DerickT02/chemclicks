import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../supabase/migrations/20261103000000_split_bohr_quizzes.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\s+/g, " ").trim().toLowerCase();

describe("Bohr quiz split migration", () => {
  it("creates separate lesson pools without removing the legacy pool", () => {
    expect(migration).toContain("insert into public.quiz_questions");
    expect(migration).toContain("'bohr_model_intro'");
    expect(migration).toContain("'bohr_model_stability'");
    expect(migration).toContain("where quiz_key = 'bohr_models'");
    expect(migration).toContain("on conflict (quiz_key, question_key) do nothing");
    expect(migration).not.toMatch(/delete\s+from\s+public\.quiz_questions/);
    expect(migration).not.toMatch(/update\s+public\.quiz_questions\s+set\s+is_active\s*=\s*false/);
  });

  it("covers the taught content for both lessons", () => {
    for (const phrase of [
      "first shell",
      "2, 8 shell arrangement",
      "2, 8, 8 shell arrangement",
      "protons and 11 electrons",
      "ionic charge",
      "neutral atom",
    ]) {
      expect(migration).toContain(phrase);
    }
  });

  it("binds new quiz keys to their matching activity types in trusted server functions", () => {
    expect(migration).toContain("student_quiz_start");
    expect(migration).toContain("student_quiz_retry_start");
    expect(migration).toContain("student_quiz_submit");
    expect(migration).toContain("p_quiz_key = ''bohr_model_intro'' and a.type::text = ''bohr_model_intro''");
    expect(migration).toContain("p_quiz_key = ''bohr_model_stability'' and a.type::text = ''bohr_model_stability''");
    expect(migration).toContain("if new.quiz_key in (''bohr_models'', ''bohr_model_intro'', ''bohr_model_stability'')");
  });

  it("leaves teacher_class_lesson_progress to the scoped fix instead of rewriting it", () => {
    // An unparenthesised OR appended here once counted every student's Bohr pass.
    expect(migration).not.toContain("p.proname = 'teacher_class_lesson_progress'");
    expect(migration).not.toContain("sa.quiz_key = ''bohr_models'')");
  });

  it("keeps the migration transactional", () => {
    expect(migration).toMatch(/\bbegin;/);
    expect(migration).toMatch(/commit;$/);
  });
});
