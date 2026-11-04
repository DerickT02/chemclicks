import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../supabase/migrations/20261104000200_shared_assignment_progress_state.sql",
      import.meta.url,
    ),
  ),
  "utf8",
)
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .toLowerCase();

function functionBody(name: string): string {
  const start = migration.indexOf(`create or replace function public.${name}(`);
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
      "teacher_class_lesson_progress(uuid, uuid)",
      "teacher_activity_attempt_summary(uuid, uuid, uuid)",
    ]) {
      expect(migration).toContain(`revoke all on function public.${signature} from public, anon, authenticated;`);
      expect(migration).toContain(`grant execute on function public.${signature} to service_role;`);
    }
  });

  it("completes an activity with a quiz only when that quiz is passed", () => {
    expect(helper).toContain("when cardinality(v_quiz_keys) = 0 then v_progress_status");
    expect(helper).toContain("when passing_attempt_number is not null then 'completed'");
    // A finished exploration alone never completes a quizzed activity.
    expect(helper).not.toMatch(/v_progress_status = 'completed' (or|and)/);
    expect(helper.match(/then 'completed'/g)).toHaveLength(2);
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
    expect(helper).toContain("when v_has_latest then 'needs_retry'");
    expect(helper).toContain("when v_progress_status = 'completed' then 'explored'");
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
    expect(helper).toMatch(/sa\.passed order by sa\.attempt_number asc limit 1/);
  });

  it("dates completion by the passing attempt, or by the exploration when there is no quiz", () => {
    expect(helper).toContain("when status <> 'completed' then null");
    expect(helper).toContain("when cardinality(v_quiz_keys) = 0 then v_progress.completed_at else passing_completed_at");
  });

  it("feeds both teacher views from the shared state", () => {
    expect(lessons).toContain("cross join lateral public.assignment_progress_state(p.id, a.type::text) st");
    expect(summary).toContain("cross join lateral public.assignment_progress_state(p.id, a.type::text) st");
    expect(lessons).toContain("'stage', lr.stage");
    expect(summary).toContain("'progressstage', st.stage");
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
