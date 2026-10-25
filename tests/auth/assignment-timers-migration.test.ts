import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/20261025182012_jira_232_assignment_timers.sql", import.meta.url)),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

function functionBody(name: string): string {
  const match = migration.match(new RegExp(
    `create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
  ));
  if (!match) throw new Error(`Missing migration function ${name}`);
  return match[0];
}

describe("SCRUM-232 assignment timer migration", () => {
  it("adds nullable timestamps and a nonnegative duration without fabricating missing history", () => {
    expect(migration).toContain("add column exploration_started_at timestamptz");
    expect(migration).toContain("add column first_quiz_started_at timestamptz");
    expect(migration).toContain("add column quiz_started_at timestamptz");
    expect(migration).toContain("add column exploration_duration_seconds bigint");
    expect(migration).toContain("exploration_duration_seconds >= 0");
    expect(migration).toContain("min(sa.started_at) as started_at");
    expect(migration).toContain("min(ms.started_at) as first_started_at");
    expect(migration).toContain("max(ms.started_at) as latest_started_at");
    expect(migration).toContain("older bohr/lewis attempts only record -- submission time");
  });

  it("does not reset the first exploration timestamp when an old exploration is retried", () => {
    const body = functionBody("student_attempt_transition");
    expect(body).toContain("exploration_started_at = case");
    expect(body).toContain("when p.exploration_started_at is not null then p.exploration_started_at");
    expect(body).toContain("when p.first_quiz_started_at is not null or p.quiz_started_at is not null then null");
    expect(body).toContain("else latest.started_at end");
  });

  it("reuses an active quiz start and requires an explicit retry after a saved result", () => {
    const body = functionBody("student_quiz_start");
    expect(body).toContain("for update");
    expect(body).toContain("if v_progress.quiz_started_at is null and v_has_quiz_history");
    expect(body).toContain("return jsonb_build_object('status', 'retry_required')");
    expect(body).toContain("v_started_at := v_progress.quiz_started_at");
    expect(body).toContain("first_quiz_started_at = case");
    expect(body).toContain("exploration_duration_seconds = case");
  });

  it("locks retry creation to completed history and keeps the first timer immutable", () => {
    const body = functionBody("student_quiz_retry_start");
    expect(body).toContain("if v_latest_completed_at is null then");
    expect(body).toContain("v_latest_completed_at < v_progress.quiz_started_at");
    expect(body).toContain("'started_at', v_progress.quiz_started_at");
    expect(body).toContain("quiz_started_at = v_started_at");
    expect(body).not.toMatch(/first_quiz_started_at\s*=/);
    expect(body).not.toMatch(/exploration_duration_seconds\s*=/);
    expect(body).toContain("for update");
  });

  it("binds grading to the exact server start and collapses competing tab submissions", () => {
    const body = functionBody("student_quiz_submit");
    expect(body).toContain("p_quiz_started_at timestamptz");
    expect(body).toContain("p_quiz_started_at is null");
    expect(body).toContain("select id, quiz_started_at into progress, started_timestamp");
    expect(body).toContain("for update");
    expect(body).toContain("started_timestamp <> p_quiz_started_at");
    expect(body).toContain("and started_at = p_quiz_started_at");
    expect(body).toContain("return next existing_attempt");
    expect(body).toContain("progress, next_attempt_number, p_quiz_key, answer_count, score_value");
    expect(body).toContain("p_quiz_started_at, completed_timestamp");
    expect(migration).toContain("drop function if exists public.student_quiz_submit(uuid, uuid, uuid, text, text, jsonb)");
    expect(migration).toContain("grant execute on function public.student_quiz_submit(uuid, uuid, uuid, text, timestamptz, text, jsonb)");
  });

  it("checks ownership, verification, class state, schedule and archive state on both quiz starts", () => {
    for (const name of ["student_quiz_start", "student_quiz_retry_start"]) {
      const body = functionBody(name);
      expect(body).toContain("s.id = p_student_id");
      expect(body).toContain("s.verified");
      expect(body).toContain("c.is_active");
      expect(body).toContain("ca.archived_at is null");
      expect(body).toContain("ca.opens_at is null or ca.opens_at <= now()");
      expect(body).toContain("ca.closes_at is null or ca.closes_at > now()");
      expect(body).toContain("if not found then");
      expect(body).toContain("raise exception");
    }
  });

  it("keeps measurement starts server-owned, resumable and subject to current access checks", () => {
    const body = functionBody("student_measurement_quiz_start");
    expect(body).toContain("where progress_id = v_progress.id and mode = p_mode and status = 'in_progress'");
    expect(body).toContain("if not found then");
    expect(body).toContain("quiz_started_at = v_session.started_at");
    expect(body).toContain("first_quiz_started_at = case");
    expect(body).toContain("exploration_duration_seconds = case");
    expect(body).toContain("s.verified and c.is_active");
    expect(body).toContain("ca.archived_at is null");
  });

  it("returns a teacher stage for no-start, exploration, active quiz, retry and pass states", () => {
    const body = functionBody("teacher_activity_attempt_summary");
    for (const stage of ["not started", "exploring", "taking quiz", "needs retry", "completed"]) {
      expect(body).toContain(`'${stage}'`);
    }
    expect(body).toContain("'explorationstartedat', p.exploration_started_at");
    expect(body).toContain("'firstquizstartedat', p.first_quiz_started_at");
    expect(body).toContain("'quizstartedat', p.quiz_started_at");
    expect(body).toContain("'explorationdurationseconds', p.exploration_duration_seconds");
  });

  it("does not expose timer RPCs to browser roles", () => {
    for (const name of ["student_attempt_transition", "student_quiz_start", "student_quiz_retry_start"]) {
      expect(migration).toContain(`revoke all on function public.${name}(`);
      expect(migration).toContain(`grant execute on function public.${name}(`);
      expect(migration).toMatch(new RegExp(`grant execute on function public\\.${name}\\([^;]*to service_role`));
    }
    expect(migration).not.toMatch(/grant execute on function public\.(student_attempt_transition|student_quiz_start|student_quiz_retry_start)\([^;]*to (anon|authenticated)/);
  });
});
