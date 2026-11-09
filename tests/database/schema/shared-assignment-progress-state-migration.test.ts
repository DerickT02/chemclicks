import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationDirectory = fileURLToPath(
  new URL("../../../supabase/migrations/", import.meta.url),
);
const migration = readdirSync(migrationDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(migrationDirectory, file), "utf8"))
  .join("\n")
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .toLowerCase();

function functionBody(name: string): string {
  const matcher = new RegExp(`(?:create or replace function|create function) public\\.${name}\\(`, "g");
  const starts = [...migration.matchAll(matcher)];
  const start = starts.at(-1)?.index ?? -1;
  if (start < 0) return "";
  return migration.slice(start, migration.indexOf("$$;", start));
}

describe("shared assignment progress state migration", () => {
  const helper = functionBody("assignment_progress_state");
  const lessons = functionBody("teacher_class_lesson_progress");
  const summary = functionBody("teacher_activity_attempt_summary");

  it("locks every function to the service role", () => {
    for (const signature of [
      "assignment_progress_state(uuid, text)",
      "student_assignment_progress_states(uuid, uuid, uuid[])",
      "teacher_class_lesson_progress(uuid, uuid)",
      "teacher_activity_attempt_summary(uuid, uuid, uuid)",
    ]) {
      expect(migration).toContain(`revoke all on function public.${signature} from public, anon, authenticated;`);
      expect(migration).toContain(`grant execute on function public.${signature} to service_role;`);
    }
  });

  it("completes a quiz-backed activity only after exploration and its matching quiz pass", () => {
    expect(helper).toContain("when v_exploration_completed and (cardinality(v_quiz_keys) = 0 or passing_attempt_number is not null) then 'completed'");
    expect(helper).not.toMatch(/when passing_attempt_number is not null then 'completed'/);
    expect(helper).toContain("v_progress.exploration_completed");
    expect(helper).toContain("v_progress.exploration_completed_at");
    expect(helper).toContain("when v_exploration_completed then 'explored'");
  });

  it("backfills reliable exploration evidence without treating an ambiguous Bohr quiz pass as exploration", () => {
    expect(migration).toContain("add column exploration_completed boolean not null default false");
    expect(migration).toContain("add column exploration_completed_at timestamptz");
    expect(migration).toContain("sa.quiz_key is null and sa.status = 'completed'");
    expect(migration).toContain("a.type::text not in ('bohr_model_intro', 'bohr_model_stability')");
    expect(migration).toContain("not exists ( select 1 from public.student_attempts quiz");
    expect(migration).toContain("quiz.quiz_key = any (array['bohr_models', 'bohr_model_intro', 'bohr_model_stability'])");
  });

  it("sets the durable exploration marker whenever an exploration attempt is completed", () => {
    const trigger = functionBody("mark_assignment_exploration_complete");
    expect(migration).toContain("create trigger student_attempts_mark_exploration_complete");
    expect(trigger).toContain("new.quiz_key is null");
    expect(trigger).toContain("new.status = 'completed'");
    expect(trigger).toContain("exploration_completed_at = coalesce(p.exploration_completed_at, new.completed_at)");
    expect(migration).toContain("drop trigger if exists student_attempts_sync_bohr_progress");
    expect(migration).toContain("drop function if exists public.sync_bohr_progress_after_quiz()");
  });

  it("grades each activity by its own quiz, keeping the split Bohr keys", () => {
    for (const [type, keys] of [
      ["bohr_model_intro", "'bohr_models', 'bohr_model_intro'"],
      ["bohr_model_stability", "'bohr_models', 'bohr_model_stability'"],
      ["lewis_structures_covalent", "'lewis_covalent'"],
      ["lewis_structures_ionic", "'lewis_ionic'"],
      ["measurement_ruler_tenths", "'measurement_ruler_tenths'"],
      ["measurement_ruler_hundredths", "'measurement_ruler_hundredths'"],
      ["measurement_graduated_cylinder_whole", "'measurement_cylinder_whole'"],
      ["measurement_graduated_cylinder", "'measurement_cylinder_tenths'"],
    ]) expect(helper).toContain(`when '${type}' then array[${keys}]`);
    expect(helper).toContain("else array[]::text[]");
    expect(helper.match(/sa\.progress_id = v_progress\.id and sa\.quiz_key = any \(v_quiz_keys\)/g)).toHaveLength(4);
  });

  it("steps through 0, 33, 66 and 100 percent stages", () => {
    expect(helper).toContain("when status = 'completed' then 'completed'");
    expect(helper).toContain("when v_quiz_open then 'quiz_in_progress'");
    expect(helper).toContain("when v_has_latest and passing_attempt_number is null then 'needs_retry'");
    expect(helper).toContain("when v_exploration_completed then 'explored'");
    expect(helper).toContain("when status <> 'not_started' then 'exploring'");
    expect(helper).not.toContain("quiz_passed");
  });

  it("treats a failed latest attempt as needing a retry and a later start as a quiz in progress", () => {
    expect(helper).toContain("when v_quiz_open then 'quiz_in_progress'");
    expect(helper).toContain("v_progress.quiz_started_at > v_latest_completed_at");
    expect(helper).toContain("ms.status = 'in_progress'");
  });

  it("counts failed attempts only up to the first pass", () => {
    expect(helper).toContain("sa.attempt_number < coalesce(passing_attempt_number, 2147483647)");
    expect(helper).toMatch(/sa\.passed order by sa\.attempt_number asc, sa\.created_at asc limit 1/);
  });

  it("dates completion by the passing attempt, or by the exploration when there is no quiz", () => {
    expect(helper).toContain("when status <> 'completed' then null");
    expect(helper).toContain("when cardinality(v_quiz_keys) = 0 then v_progress.exploration_completed_at");
    expect(helper).toContain("greatest(v_progress.exploration_completed_at, passing_completed_at)");
    expect(helper).toContain("passing_quiz_key");
  });

  it("provides an ownership-checked, service-only batch state read", () => {
    const batch = functionBody("student_assignment_progress_states");
    expect(batch).toContain("security invoker");
    expect(batch).toContain("s.id = p_student_id");
    expect(batch).toContain("ca.class_id = p_class_id");
    expect(batch).toContain("ca.archived_at is null");
    expect(batch).toContain("assignment_progress_state(p.id, a.type::text)");
  });

  it("feeds both teacher views from the shared state", () => {
    expect(lessons).toContain("cross join lateral public.assignment_progress_state(p.id, a.type::text) st");
    expect(summary).toContain("cross join lateral public.assignment_progress_state(p.id, a.type::text) st");
    expect(lessons).toContain("'stage', lr.stage");
    expect(summary).toContain("'progressstage', st.stage");
    expect(summary).toContain("'explorationstatus', case when st.exploration_completed then 'completed'");
  });

  it("reports one exploration duration: the saved exploration-to-first-quiz interval", () => {
    expect(summary).toContain("'explorationdurationseconds', p.exploration_duration_seconds");
    expect(summary).toContain("'timetofirstquizseconds', p.exploration_duration_seconds");
    expect(lessons).toContain("'timetofirstquizseconds', lr.exploration_duration_seconds");
    expect(summary).not.toContain("p.completed_at - p.started_at");
  });

  it("keeps ownership checks and the archived-assignment filter", () => {
    expect(lessons).toContain("where c.id = p_class_id and t.id = p_teacher_id");
    expect(lessons).toContain("where ca.class_id = c.id and ca.archived_at is null");
    expect(summary).toContain("where c.id = p_class_id and ca.id = p_assignment_id and t.id = p_teacher_id");
    expect(lessons).toContain("using errcode = '42501'");
    expect(summary).toContain("using errcode = '42501'");
  });
});
