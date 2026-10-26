import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/20261026043835_jira_232_live_compatibility.sql", import.meta.url)),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

function functionBody(signature: string): string {
  const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = migration.match(new RegExp(
    `create or replace function public\\.${escaped}[\\s\\S]*?\\$\\$;`,
  ));
  if (!match) throw new Error(`Missing migration function ${signature}`);
  return match[0];
}

describe("SCRUM-232 live compatibility migration", () => {
  it("keeps the six-argument dev RPC callable and delegates to the timestamp-bound grader", () => {
    const legacy = functionBody("student_quiz_submit( p_student_id uuid, p_class_id uuid, p_assignment_id uuid, p_quiz_key text, p_submission_key text, p_answers jsonb )");

    expect(legacy).toContain("select p.quiz_started_at into v_quiz_started_at");
    expect(legacy).toContain("and p.class_activity_id = p_assignment_id");
    expect(legacy).toContain("for update");
    expect(legacy).toContain("if not found or v_quiz_started_at is null");
    expect(legacy).toContain("p_quiz_key, v_quiz_started_at, p_submission_key, p_answers");
    expect(migration).toContain("revoke all on function public.student_quiz_submit(uuid, uuid, uuid, text, text, jsonb)");
    expect(migration).toContain("grant execute on function public.student_quiz_submit(uuid, uuid, uuid, text, text, jsonb) to service_role");
    expect(migration).not.toMatch(/grant execute on function public\.student_quiz_submit\([^;]*to (anon|authenticated)/);
  });

  it("preserves completed measurement progress when a quiz start changes its timer", () => {
    const trigger = functionBody("preserve_completed_progress_on_quiz_start()");
    expect(trigger).toContain("old.status = 'completed'");
    expect(trigger).toContain("new.quiz_started_at is distinct from old.quiz_started_at");
    expect(trigger).toContain("new.status := old.status");
    expect(trigger).toContain("new.completed_at := old.completed_at");
    expect(migration).toContain("before update of quiz_started_at on public.student_progress");

    // Repair only completions recorded before the timer start. A migration-
    // closed, formerly open exploration row has completed_at equal to start.
    expect(migration).toContain("sa.completed_at < p.quiz_started_at");
    expect(migration).toContain("'measurement_ruler_tenths'");
    expect(migration).toContain("'measurement_graduated_cylinder'");
  });

  it("returns grade summary and timer fields together without conflating durations", () => {
    const summary = functionBody("teacher_activity_attempt_summary( p_teacher_id uuid, p_class_id uuid, p_assignment_id uuid )");
    for (const key of [
      "'overallstatus'", "'explorationstatus'", "'explorationdurationseconds'",
      "'passingquizattemptnumber'", "'passingquizscore'", "'passingquiztotal'",
      "'passingquizpercentage'", "'passingquizcompletedat'", "'failedquizattemptcount'",
      "'stage'", "'explorationstartedat'", "'firstquizstartedat'", "'quizstartedat'",
      "'timetofirstquizseconds'",
    ]) expect(summary).toContain(key);

    expect(summary).toContain("'explorationdurationseconds', case");
    expect(summary).toContain("'timetofirstquizseconds', p.exploration_duration_seconds");
    expect(summary).toContain("ms.status = 'in_progress'");
    expect(summary).toContain("p.quiz_started_at > latest_quiz.completed_at");
  });

  it("retains teacher-only access and refreshes PostgREST after restoring the RPC", () => {
    expect(migration).toContain("revoke all on function public.teacher_activity_attempt_summary(uuid, uuid, uuid)");
    expect(migration).toContain("grant execute on function public.teacher_activity_attempt_summary(uuid, uuid, uuid) to service_role");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });
});
