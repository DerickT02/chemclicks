import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (name: string) => readFileSync(new URL(`../../supabase/migrations/${name}.sql`, import.meta.url), "utf8").replace(/\s+/g, " ").toLowerCase();
const broadcast = read("20261027000000_teacher_class_broadcasts");
const summary = read("20261027010000_teacher_live_attempt_summary");

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
    expect(summary).toContain("s.class_id = c.id and (p_student_id is null or s.id = p_student_id)");
    expect(summary).toContain("and c.is_active and ca.archived_at is null");
    expect(summary).toContain("t.id = p_teacher_id");
    expect(summary).toContain("from public, anon, authenticated");
    expect(summary).toContain("to service_role");
    expect(summary).not.toContain("create or replace function public.teacher_activity_attempt_summary");
  });
  it("preserves the canonical grade and timer CASE expressions", () => {
    const canonical = read("20261026043835_jira_232_live_compatibility");
    for (const [start, end] of [["'overallstatus', case", "'attempts', history.attempts"], ["left join lateral ( select sa.attempt_number", "where s.class_id = c.id"]]) {
      const extract = (sql: string) => sql.slice(sql.indexOf(start), sql.indexOf(end, sql.indexOf(start))).replace(/\s/g, "");
      expect(extract(summary)).toBe(extract(canonical));
    }
  });
});
