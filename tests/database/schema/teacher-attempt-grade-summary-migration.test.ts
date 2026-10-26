import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../supabase/migrations/20261025120000_teacher_attempt_grade_summary.sql",
      import.meta.url,
    ),
  ),
  "utf8",
)
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("teacher_attempt_grade_summary migration", () => {
  it("replaces teacher_activity_attempt_summary in place", () => {
    expect(migration).toContain(
      "create or replace function public.teacher_activity_attempt_summary(",
    );
  });

  it("re-checks class ownership inside the function instead of trusting the caller", () => {
    expect(migration).toContain("join public.teachers t on t.id = c.teacher_id");
    expect(migration).toContain(
      "where c.id = p_class_id and ca.id = p_assignment_id and t.id = p_teacher_id",
    );
    expect(migration).toContain("if result is null then");
    expect(migration).toContain("raise exception");
  });

  it("marks a bohr lesson completed from exploration or a passed quiz, since both bohr lessons share one quiz", () => {
    expect(migration).toContain("'bohr_model_intro', 'bohr_model_stability'");
    expect(migration).toContain(
      "coalesce(p.status, 'not_started') = 'completed' or passing_attempt.passing_attempt_number is not null then 'completed'",
    );
  });

  it("requires both the explorer and a passed quiz for a covalent/ionic lesson to read completed", () => {
    expect(migration).toContain("'lewis_structures_covalent', 'lewis_structures_ionic'");
    expect(migration).toContain(
      "coalesce(p.status, 'not_started') = 'completed' and passing_attempt.passing_attempt_number is not null then 'completed'",
    );
  });

  it("falls back to exploration-only completion for every other activity type, including measurement", () => {
    expect(migration).toContain(
      "when coalesce(p.status, 'not_started') = 'completed' then 'completed'",
    );
  });

  it("surfaces an open quiz attempt as taking_quiz before it is submitted", () => {
    expect(migration).toContain(
      "bool_or(sa.quiz_key is not null and sa.status = 'in_progress') as has_open_quiz_attempt",
    );
    expect(migration).toContain("when history.has_open_quiz_attempt then 'taking_quiz'");
  });

  it("flags needs_retry only once a quiz attempt has been completed without passing", () => {
    expect(migration).toContain("when failure_calc.failed_count > 0 then 'needs_retry'");
  });

  it("only reports an exploration duration once the exploration attempt is completed", () => {
    expect(migration).toContain(
      "when p.status = 'completed' and p.started_at is not null and p.completed_at is not null",
    );
    expect(migration).toContain(
      "then extract(epoch from (p.completed_at - p.started_at))::integer",
    );
  });

  it("picks the earliest passed quiz attempt as the one that completed the lab", () => {
    expect(migration).toContain("and sa.status = 'completed' and sa.passed");
    expect(migration).toContain("order by sa.attempt_number asc limit 1");
    expect(migration).toContain("left join lateral (");
  });

  it("only counts failed attempts that happened before the pass, not retries taken afterward", () => {
    expect(migration).toContain(
      "and sa.attempt_number < coalesce(passing_attempt.passing_attempt_number, 2147483647)",
    );
  });
});
