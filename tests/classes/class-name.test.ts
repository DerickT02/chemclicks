import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { classLabelKey, normalizeClassLabel } from "@/lib/classes/class-name";
import { isDuplicateClassNameSectionError, teacherHasClassNamed } from "@/lib/db/classes";

function fakeClient(rows: { name: string; section: string }[], error: unknown = null) {
  const eq = vi.fn(async () => ({ data: error ? null : rows, error }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from, select, eq };
}

describe("class label normalization", () => {
  it("trims and collapses whitespace but keeps casing", () => {
    expect(normalizeClassLabel("  Chem \t  3 ")).toBe("Chem 3");
  });

  it("compares case-insensitively", () => {
    expect(classLabelKey(" CHEM  3")).toBe(classLabelKey("chem 3"));
  });
});

describe("teacherHasClassNamed", () => {
  const rows = [{ name: "Chem 3", section: "Room 204" }];

  it("matches a case- and spacing-variant of an existing pair", async () => {
    const { client, eq } = fakeClient(rows);

    expect(await teacherHasClassNamed(client, "teacher-a", "chem   3", " ROOM 204")).toEqual({
      exists: true,
      error: null,
    });
    expect(eq).toHaveBeenCalledWith("teacher_id", "teacher-a");
  });

  it("does not match the same name with a different section", async () => {
    const { client } = fakeClient(rows);
    expect((await teacherHasClassNamed(client, "teacher-a", "Chem 3", "Room 105")).exists).toBe(false);
  });

  it("does not match the same section with a different name", async () => {
    const { client } = fakeClient(rows);
    expect((await teacherHasClassNamed(client, "teacher-a", "Chem 4", "Room 204")).exists).toBe(false);
  });

  it("returns lookup errors to the caller", async () => {
    const { client } = fakeClient([], { message: "boom" });
    expect(await teacherHasClassNamed(client, "teacher-a", "Chem 3", "")).toEqual({
      exists: false,
      error: { message: "boom" },
    });
  });
});

describe("isDuplicateClassNameSectionError", () => {
  const err = (code: string, message: string) =>
    ({ code, message, details: "", hint: "", name: "PostgrestError" }) as Parameters<
      typeof isDuplicateClassNameSectionError
    >[0];

  it("recognizes both the exact constraint and the normalized index", () => {
    expect(isDuplicateClassNameSectionError(err("23505", 'constraint "classes_teacher_name_section_key"'))).toBe(true);
    expect(isDuplicateClassNameSectionError(err("23505", 'constraint "classes_teacher_name_section_norm_key"'))).toBe(true);
  });

  it("ignores class code conflicts and other errors", () => {
    expect(isDuplicateClassNameSectionError(err("23505", 'constraint "classes_class_code_key"'))).toBe(false);
    expect(isDuplicateClassNameSectionError(err("23514", "classes_teacher_name_section"))).toBe(false);
  });
});
