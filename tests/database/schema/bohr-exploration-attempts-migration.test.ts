import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasActivityContent } from "@/lib/assignments/activity-content";
import type { ActivityType } from "@/lib/db/activities";

const migrationPath = fileURLToPath(
  new URL(
    "../../../supabase/migrations/20261010190000_bohr_exploration_attempts.sql",
    import.meta.url,
  ),
);
const migration = readFileSync(migrationPath, "utf8")
  .replace(/\s+/g, " ")
  .toLowerCase();

const supportedTypes = [...(migration.match(/a\.type::text in \(([^)]*)\)/)?.[1] ?? "")
  .matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);

describe("Bohr exploration attempts migration", () => {
  it("authorizes transitions for both Bohr activity types", () => {
    expect(supportedTypes).toContain("bohr_model_intro");
    expect(supportedTypes).toContain("bohr_model_stability");
  });

  it("allows exactly the activity types the app renders content for", () => {
    const everyType: ActivityType[] = [
      "bohr_model_intro", "bohr_model_stability", "lewis_diagram",
      "lewis_structures_covalent", "lewis_structures_ionic",
      "measurement_ruler_tenths", "measurement_ruler_hundredths", "measurement_graduated_cylinder",
    ];
    expect([...supportedTypes].sort()).toEqual(everyType.filter(hasActivityContent).sort());
  });

  it("keeps the class, schedule and archive checks", () => {
    expect(migration).toContain("where ca.id = p_assignment_id and c.id = p_class_id");
    expect(migration).toContain("and s.id = p_student_id and c.is_active");
    expect(migration).toContain("and ca.archived_at is null");
    expect(migration).toContain("and (ca.opens_at is null or ca.opens_at <= now())");
    expect(migration).toContain("and (ca.closes_at is null or ca.closes_at > now())");
  });

  it("scopes every attempt lookup to exploration rows and never grades", () => {
    expect(migration).toContain("where progress_id=progress and quiz_key is null");
    expect(migration).toContain("where id=p_attempt_id and progress_id=progress and quiz_key is null");
    expect(migration).not.toMatch(/passed\s*=|score\s*=|percentage\s*=/);
    expect(migration).toContain("insert into public.student_attempts(progress_id,attempt_number)");
  });

  it("stays callable only by the service role", () => {
    expect(migration).toContain(
      "revoke all on function public.student_attempt_transition(uuid,uuid,uuid,text,uuid) from public,anon,authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.student_attempt_transition(uuid,uuid,uuid,text,uuid) to service_role",
    );
  });
});
