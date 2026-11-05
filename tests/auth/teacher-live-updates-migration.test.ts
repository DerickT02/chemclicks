import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (name: string) => readFileSync(new URL(`../../supabase/migrations/${name}.sql`, import.meta.url), "utf8").replace(/\s+/g, " ").toLowerCase();
const broadcast = read("20261105000000_teacher_class_broadcasts");
const summary = read("20261105010000_teacher_live_attempt_summary");
const budget = read("20261105020000_budget_teacher_notifications");

describe("teacher live update migration contracts", () => {
  it("authorizes private topics using verified, non-student, owning teachers and active classes", () => {
    for (const check of ["c.teacher_id = (select auth.uid())", "c.is_active", "u.email_confirmed_at is not null", "not coalesce(u.is_anonymous, false)", "s.auth_user_id = u.id", "p_topic = 'teacher-class:' || c.id::text"]) expect(broadcast).toContain(check);
    expect(broadcast).toContain("security definer set search_path = ''");
    expect(broadcast).toContain("as restrictive for select to authenticated");
    expect(broadcast).toContain("as restrictive for select to anon");
    expect(broadcast).toContain("as restrictive for insert to anon, authenticated");
    expect(broadcast).not.toContain("alter table realtime.messages");
  });
  it("emits only private invalidation hints, for both old/new class scopes", () => {
    expect(broadcast).toContain("jsonb_build_object('kind', change_kind, 'assignmentid', assignment_id), 'changed', 'teacher-class:' || class_id::text, true");
    expect(broadcast).toContain("jsonb_build_array(to_jsonb(old), to_jsonb(new))");
    expect(broadcast).not.toContain("realtime.broadcast_changes");
    for (const table of ["students", "student_progress", "student_attempts", "measurement_quiz_sessions", "class_activities", "classes"]) expect(broadcast).toContain(`on public.${table} for each row execute function private.broadcast_teacher_class_change()`);
    expect(broadcast).toContain("revoke all on function private.broadcast_teacher_class_change() from public, anon, authenticated");
  });
  it("avoids building history JSON for overview reads and scopes expanded histories to one student", () => {
    expect(summary).toContain("p_include_attempts boolean default false, p_student_id uuid default null");
    expect(summary).toContain("filter (where p_include_attempts), '[]'::jsonb) as attempts");
    expect(summary).toContain("s.class_id = c.id and (p_student_ids is null or s.id = any(p_student_ids))");
    expect(summary).toContain("case when p_student_id is null then null::uuid[] else array[p_student_id] end, true)");
    expect(summary).toContain("(not p_require_active or (c.is_active and ca.archived_at is null))");
    expect(summary).toContain("t.id = p_teacher_id");
    expect(summary).toContain("from public, anon, authenticated");
    expect(summary).toContain("to service_role");
  });
  it("coalesces hints at the database source for the whole transaction", () => {
    expect(budget).toContain("current_setting('chemclicks.teacher_broadcasts', true)");
    expect(budget).toContain("and not (seen ? hint_key)");
    expect(budget).toContain("set_config('chemclicks.teacher_broadcasts', seen::text, true)");
    expect(budget).toContain("coalesce(assignment_id::text, 'all')");
    expect(budget).toContain("jsonb_build_array(to_jsonb(old), to_jsonb(new))");
    expect(budget).toContain("revoke all on function private.broadcast_teacher_class_change() from public, anon, authenticated");
    expect(budget).not.toContain("create policy");
  });
  it("builds every attempt report from the shared assignment state", () => {
    const shared = read("20261104000200_shared_assignment_progress_state");
    expect(summary).toContain("cross join lateral public.assignment_progress_state(p.id, a.type::text) st");
    // No private copy of quiz keys or completion rules that could drift.
    expect(summary).not.toContain("quiz_key = (case");
    expect(summary).not.toContain("'bohr_models'");
    const keys = (sql: string) => {
      const start = sql.indexOf("'overallstatus', case st.stage");
      expect(start).toBeGreaterThanOrEqual(0);
      return sql.slice(start, sql.indexOf("'attempts', history.attempts", start)).replace(/\s/g, "");
    };
    expect(keys(summary)).toBe(keys(shared));
    // The full report delegates, so the live and full views cannot disagree.
    expect(summary).toContain("private.teacher_attempt_rows(p_teacher_id, p_class_id, p_assignment_id, true, null, false)");
  });
});
