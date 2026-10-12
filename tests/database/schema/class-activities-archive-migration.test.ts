import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../../supabase/migrations/20261002194600_class_activities_archive.sql",
    import.meta.url,
  ),
);
const migration = readFileSync(migrationPath, "utf8")
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("class activities archive migration", () => {
  it("adds archived_at and replaces the active-only uniqueness rule", () => {
    expect(migration).toContain("add column if not exists archived_at timestamptz");
    expect(migration).toContain(
      "drop constraint if exists class_activities_class_activity_key",
    );
    expect(migration).toContain("class_activities_active_class_activity_key");
    expect(migration).toContain("where archived_at is null");
  });

  it("blocks attempt transitions on archived assignments", () => {
    expect(migration).toContain("and ca.archived_at is null");
  });
});
