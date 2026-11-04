import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (name: string) => readFileSync(new URL(`../../supabase/migrations/${name}.sql`, import.meta.url), "utf8").replace(/\s+/g, " ").toLowerCase();
const revisions = read("20261027030000_teacher_student_revisions");
const reads = read("20261027040000_teacher_incremental_reads");
const oldAttempts = read("20261027010000_teacher_live_attempt_summary");
const oldLessons = read("20261012050000_exclude_archived_assignments");
const slice = (text: string, start: string, end: string) => {
  const index = text.indexOf(start);
  expect(index).toBeGreaterThanOrEqual(0);
  return text.slice(index, text.indexOf(end, index)).replace(/\s/g, "");
};

describe("incremental teacher data migrations", () => {
  it("keeps journals private and stores only the latest revision per student", () => {
    expect(revisions).toContain("primary key (class_id, student_id)");
    expect(revisions).toContain("alter table private.teacher_class_versions enable row level security");
    expect(revisions).toContain("alter table private.teacher_changed_students enable row level security");
    expect(revisions).toContain("revoke all on private.teacher_class_versions, private.teacher_changed_students from public, anon, authenticated");
    expect(revisions).toContain("on conflict (class_id, student_id) do update set revision = excluded.revision");
    expect(revisions).toContain("on delete cascade");
    expect(revisions).toContain("delete from private.teacher_changed_students where class_id = p_class_id and revision < v_revision");
  });
  it("serializes revisions per class and reuses the revision inside a transaction", () => {
    expect(revisions).toContain("on conflict (class_id) do update set revision = private.teacher_class_versions.revision + 1");
    expect(revisions).toContain("set_config('chemclicks.teacher_revisions', versions::text, true)");
    expect(revisions).toContain("set_config('chemclicks.teacher_students', students_seen::text, true)");
    expect(revisions).toContain("set_config('chemclicks.teacher_broadcasts', hints_seen::text, true)");
    expect(revisions).toContain("jsonb_build_array(to_jsonb(old), to_jsonb(new))");
  });
  it("returns data for only changed enrolled students and keeps deletion tombstones", () => {
    expect(reads).toContain("j.revision > p_after");
    expect(reads).toContain("s.id = any(scoped.student_ids)");
    expect(reads).toContain("s.id = any(p_student_ids)");
    expect(reads).toContain("'removedstudentids'");
    expect(reads).toContain("s.id = changed.student_id and s.class_id = scoped.id");
    expect(reads).toContain("scoped.revision::text");
  });
  it("checks ownership once per combined snapshot and limits the public RPC to the service role", () => {
    expect(reads).toContain("language plpgsql stable security invoker set search_path = ''");
    expect(reads).toContain("c.id = p_class_id and c.teacher_id = p_teacher_id and c.is_active");
    expect(reads).toContain("ca.class_id = c.id and ca.archived_at is null");
    expect(reads).toContain("revoke all on function public.teacher_class_updates(uuid, uuid, bigint, uuid) from public, anon, authenticated");
    expect(reads).toContain("grant execute on function public.teacher_class_updates(uuid, uuid, bigint, uuid) to service_role");
  });
  it("uses full resets for assignment/catalog changes and invalid cursors without adding row data to broadcasts", () => {
    expect(revisions).toContain("after update of title, type, order_index on public.activities");
    expect(revisions).toContain("set reset_revision = v_revision");
    expect(revisions).toContain("jsonb_build_object('kind', p_kind, 'assignmentid', p_assignment_id)");
    expect(reads).toContain("p_after > coalesce(v.revision, 0)");
    expect(reads).toContain("p_after < coalesce(v.reset_revision, 0)");
  });
  it("preserves existing attempt grades/timers and lesson completion rules", () => {
    expect(slice(reads, "'overallstatus', case", "'attempts', history.attempts")).toBe(slice(oldAttempts, "'overallstatus', case", "'attempts', history.attempts"));
    expect(slice(reads, "case when a.type::text in ('bohr_model_intro'", "end as status")).toBe(slice(oldLessons, "case when a.type::text in ('bohr_model_intro'", "end as status"));
  });
});
