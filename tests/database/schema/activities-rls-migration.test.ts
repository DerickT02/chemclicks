import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../../supabase/migrations/20260923210500_activities_rls.sql",
    import.meta.url,
  ),
);
const migration = readFileSync(migrationPath, "utf8")
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("activities RLS migration", () => {
  it("enables RLS and denies anonymous catalog access", () => {
    expect(migration).toContain(
      "alter table public.activities enable row level security",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.activities from anon",
    );
  });

  it("allows authenticated catalog reads without client write privileges", () => {
    expect(migration).toContain(
      "grant select on table public.activities to authenticated",
    );
    expect(migration).toContain(
      "revoke insert, update, delete, truncate, references, trigger on table public.activities from authenticated",
    );
    expect(migration).toContain("for select to authenticated using (true)");
    expect(migration).not.toMatch(
      /create policy .* for (insert|update|delete|all) /,
    );
  });

  it("does not alter related class activity policies", () => {
    expect(migration).not.toContain("class_activities");
  });
});
