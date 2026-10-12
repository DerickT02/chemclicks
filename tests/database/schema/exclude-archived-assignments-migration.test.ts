import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../supabase/migrations/20261012050000_exclude_archived_assignments.sql",
      import.meta.url,
    ),
  ),
  "utf8",
)
  .replace(/\s+/g, " ")
  .toLowerCase();

function functionBody(name: string): string {
  const start = migration.indexOf(`create or replace function public.${name}(`);
  if (start < 0) return "";
  return migration.slice(start, migration.indexOf("$$;", start));
}

describe("exclude archived assignments migration", () => {
  it.each([
    "student_quiz_submit",
    "student_measurement_quiz_start",
    "student_measurement_quiz_record_answer",
    "student_measurement_quiz_complete",
  ])("refuses an archived assignment in %s", (name) => {
    const body = functionBody(name);
    expect(body).toContain("and c.is_active and ca.archived_at is null");
    expect(body).toContain("and (ca.opens_at is null or ca.opens_at <= now())");
    expect(body).toContain("and (ca.closes_at is null or ca.closes_at > now())");
  });

  it("leaves archived assignments out of the teacher's lesson progress", () => {
    expect(functionBody("teacher_class_lesson_progress")).toContain(
      "where ca.class_id = c.id and ca.archived_at is null",
    );
  });

  it("still returns a finished measurement attempt before checking the assignment", () => {
    const body = functionBody("student_measurement_quiz_complete");
    expect(body.indexOf("if v_session.status = 'completed' then"))
      .toBeLessThan(body.indexOf("ca.archived_at is null"));
  });

  it("keeps the 0–10 cm ruler answer bound from the ruler range migration", () => {
    expect(functionBody("student_measurement_quiz_record_answer")).toContain("else 10 end");
  });
});
