import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (name: string) => readFileSync(new URL(`../../supabase/migrations/${name}.sql`, import.meta.url), "utf8").replace(/\s+/g, " ").toLowerCase();
const revisions = read("20261105030000_teacher_student_revisions");
const reads = read("20261105040000_teacher_incremental_reads");
const shared = read("20261104000200_shared_assignment_progress_state");
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
  it("builds lesson rows from the shared assignment state and delegates the full class view", () => {
    expect(reads).toContain("cross join lateral public.assignment_progress_state(p.id, a.type::text) st");
    expect(reads).not.toContain("quiz_key = (case");
    expect(slice(reads, "'assignmentid', lr.assignment_id", "where ca.class_id"))
      .toBe(slice(shared, "'assignmentid', lr.assignment_id", "where ca.class_id"));
    expect(reads).toContain("'students', private.teacher_lesson_progress_rows(c.id, null)");
    expect(reads).toContain("private.teacher_attempt_rows(p_teacher_id, scoped.id, p_assignment_id, false, scoped.student_ids, true)");
  });
});
