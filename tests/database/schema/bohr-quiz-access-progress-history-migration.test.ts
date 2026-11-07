import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const directory = new URL("../../../supabase/migrations/", import.meta.url);
const filename = "20261104000300_fix_bohr_quiz_access_and_progress_history.sql";
const readMigration = (name: string): string => readFileSync(new URL(name, directory), "utf8")
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();
const migration = readMigration(filename);
const previous = readMigration("20261104000200_shared_assignment_progress_state.sql");

function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  return sql.slice(start, sql.indexOf("$$;", start) + 3);
}

const helper = functionBody(migration, "assignment_progress_state");

describe("Bohr quiz access and progress history forward migration", () => {
  it("adds a distinct forward version without changing stored data", () => {
    const names = readdirSync(fileURLToPath(directory));
    expect(names.filter(name => name.startsWith("20261104000300_"))).toEqual([filename]);
    expect(filename > "20261104000200_shared_assignment_progress_state.sql").toBe(true);
    expect(migration).toMatch(/^begin;/);
    expect(migration).toMatch(/commit;$/);
    expect(migration).toContain("notify pgrst, 'reload schema'");
    expect(migration).not.toMatch(/\b(insert into|update public\.|delete from|truncate)\b/);
    expect(migration).not.toContain("pg_get_functiondef");
  });

  it("hides both split answer-key pools while preserving all existing gated pools", () => {
    expect(migration).toContain('drop policy if exists "chemclicks_quiz_questions_select_active" on public.quiz_questions');
    expect(migration).toContain("for select to authenticated using (is_active and quiz_key not in (");
    const excluded = migration.match(/quiz_key not in \(([^)]+)\)/)?.[1].match(/'[^']+'/g);
    expect(excluded).toEqual([
      "'bohr_models'", "'bohr_model_intro'", "'bohr_model_stability'",
      "'lewis_bonding'", "'lewis_covalent'", "'lewis_ionic'",
    ]);
  });

  it("keeps the shared helper's signature and activity-to-quiz mapping", () => {
    const original = functionBody(previous, "assignment_progress_state");
    expect(helper.slice(0, helper.indexOf("declare"))).toBe(original.slice(0, original.indexOf("declare")));
    const mapping = (sql: string) => sql.match(/v_quiz_keys := case p_activity_type .*? end;/)?.[0];
    expect(mapping(helper)).toBeDefined();
    expect(mapping(helper)).toBe(mapping(original));
    expect(helper.match(/sa\.progress_id = v_progress\.id and sa\.quiz_key = any \(v_quiz_keys\)/g)).toHaveLength(4);
  });

  it("selects the first pass and latest result by completion time, never by per-key attempt number", () => {
    expect(helper).toContain("order by sa.completed_at asc nulls last, sa.created_at asc, sa.id asc limit 1");
    expect(helper).toContain("order by sa.completed_at desc nulls last, sa.created_at desc, sa.id desc limit 1");
    expect(helper).not.toContain("order by sa.attempt_number");
    expect(helper).toContain("select sa.attempt_number, sa.score, sa.question_total, sa.percentage,");
  });

  it("counts failures before the first pass using the same chronological tie-breakers", () => {
    expect(helper).toContain("and (v_passing_id is null or (sa.completed_at, sa.created_at, sa.id) < (passing_completed_at, v_passing_created_at, v_passing_id))");
    expect(helper).not.toMatch(/sa\.attempt_number\s*</);
  });

  it("preserves the existing completion, stage and quiz-open rules", () => {
    const original = functionBody(previous, "assignment_progress_state");
    expect(helper.slice(helper.indexOf("v_quiz_open :="))).toBe(original.slice(original.indexOf("v_quiz_open :=")));
  });

  it("changes only the history ordering in the detailed report, retaining ownership and response keys", () => {
    const expected = functionBody(previous, "teacher_activity_attempt_summary")
      .replace("order by sa.attempt_number desc, sa.created_at desc", "order by sa.started_at desc nulls last, sa.created_at desc, sa.id desc");
    expect(functionBody(migration, "teacher_activity_attempt_summary")).toBe(expected);
  });

  it("retains service-role-only access for both read functions", () => {
    for (const signature of [
      "assignment_progress_state(uuid, text)",
      "teacher_activity_attempt_summary(uuid, uuid, uuid)",
    ]) {
      expect(migration).toContain(`revoke all on function public.${signature} from public, anon, authenticated;`);
      expect(migration).toContain(`grant execute on function public.${signature} to service_role;`);
    }
  });
});
