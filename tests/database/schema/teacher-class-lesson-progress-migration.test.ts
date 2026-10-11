import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../supabase/migrations/20261010000000_teacher_class_lesson_progress.sql",
      import.meta.url,
    ),
  ),
  "utf8",
)
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("teacher_class_lesson_progress migration", () => {
  it("defines the function and locks it down to the service role only", () => {
    expect(migration).toContain(
      "create or replace function public.teacher_class_lesson_progress(",
    );
    expect(migration).toContain(
      "revoke all on function public.teacher_class_lesson_progress(uuid, uuid) from public, anon, authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.teacher_class_lesson_progress(uuid, uuid) to service_role;",
    );
  });

  it("re-checks class ownership inside the function instead of trusting the caller", () => {
    expect(migration).toContain("join public.teachers t on t.id = c.teacher_id");
    expect(migration).toContain("where c.id = p_class_id and t.id = p_teacher_id");
    expect(migration).toContain("if result is null then");
    expect(migration).toContain("raise exception");
  });

  it("derives bohr lesson status from a passing quiz attempt, not student_progress", () => {
    expect(migration).toContain("'bohr_model_intro', 'bohr_model_stability'");
    expect(migration).toContain("when quiz.passed_count > 0 then 'completed'");
    expect(migration).toContain("when quiz.attempt_count > 0 then 'in_progress'");
  });

  it("requires both the explorer and the quiz for a covalent/ionic lesson to read completed", () => {
    expect(migration).toContain("'lewis_structures_covalent', 'lewis_structures_ionic'");
    expect(migration).toContain(
      "coalesce(p.status, 'not_started') = 'completed' and quiz.passed_count > 0",
    );
  });

  it("falls back to student_progress.status for every other (exploration-only) lesson type", () => {
    expect(migration).toContain("else coalesce(p.status::text, 'not_started')");
  });

  it("maps each quiz-bearing activity type to its own quiz_key", () => {
    expect(migration).toContain("then 'bohr_models'");
    expect(migration).toContain("then 'lewis_covalent'");
    expect(migration).toContain("then 'lewis_ionic'");
  });

  it("orders lessons deterministically instead of relying on database row order", () => {
    expect(migration).toContain("order by lr.order_index, lr.created_at");
  });

  it("handles a class with no assignments or no progress without dividing by zero", () => {
    expect(migration).toContain("case when count(*) = 0 then 0");
  });
});
