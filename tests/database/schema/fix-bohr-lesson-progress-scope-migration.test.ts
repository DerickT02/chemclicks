import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../../supabase/migrations/${name}`, import.meta.url)), "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

const hotfix = read("20261104000000_fix_bohr_lesson_progress_scope.sql");

// The quiz filter of each version of teacher_class_lesson_progress, from the
// progress-row condition to the end of the lateral subquery.
function quizFilter(sql: string): string {
  const end = sql.indexOf(") quiz");
  return sql.slice(sql.lastIndexOf("where sa.progress_id = p.id", end), end);
}

describe("fix Bohr lesson progress scope migration", () => {
  it("keeps every quiz-key alternative inside the student's own progress row", () => {
    const filter = quizFilter(hotfix);
    expect(filter.startsWith("where sa.progress_id = p.id and (")).toBe(true);
    // Every OR is nested in the parenthesised group after the progress-row check.
    const afterProgress = filter.slice("where sa.progress_id = p.id and ".length);
    let depth = 0;
    for (const [index, char] of [...afterProgress].entries()) {
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (afterProgress.startsWith(" or ", index)) expect(depth).toBeGreaterThan(0);
    }
  });

  it("accepts the legacy and split Bohr keys only for the matching lesson", () => {
    const filter = quizFilter(hotfix);
    expect(filter).toContain("(a.type::text = 'bohr_model_intro' and sa.quiz_key in ('bohr_models', 'bohr_model_intro'))");
    expect(filter).toContain("(a.type::text = 'bohr_model_stability' and sa.quiz_key in ('bohr_models', 'bohr_model_stability'))");
    expect(filter).toContain("(a.type::text = 'lewis_structures_covalent' and sa.quiz_key = 'lewis_covalent')");
    expect(filter).toContain("(a.type::text = 'lewis_structures_ionic' and sa.quiz_key = 'lewis_ionic')");
  });

  it("keeps ownership, the archive filter and service-role-only access", () => {
    expect(hotfix).toContain("where c.id = p_class_id and t.id = p_teacher_id");
    expect(hotfix).toContain("where ca.class_id = c.id and ca.archived_at is null");
    expect(hotfix).toContain("revoke all on function public.teacher_class_lesson_progress(uuid, uuid) from public, anon, authenticated;");
    expect(hotfix).toContain("grant execute on function public.teacher_class_lesson_progress(uuid, uuid) to service_role;");
  });

  it("is not undone by the later shared-state migration", () => {
    const shared = read("20261104020000_shared_assignment_progress_state.sql");
    expect(shared).toContain("when 'bohr_model_stability' then array['bohr_models', 'bohr_model_stability']");
    // Every quiz read stays on the student's own progress row.
    expect(shared.match(/sa\.quiz_key = any \(v_quiz_keys\)/g)?.length)
      .toBe(shared.match(/sa\.progress_id = v_progress\.id and sa\.quiz_key = any \(v_quiz_keys\)/g)?.length);
  });
});
