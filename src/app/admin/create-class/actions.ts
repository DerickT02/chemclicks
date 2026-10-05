'use server';

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherId } from "@/lib/server/teacher";
import { findClassByCode, insertClass, isDuplicateClassCodeError } from "@/lib/db/classes";
import { isValidClassCode, normalizeClassCode, randomClassCode } from "@/lib/classes/class-code";
import { DATABASE_RETRY_MESSAGE } from "@/lib/errors/user-facing-errors";

type CreateClassInput = {
  className: string;
  section: string;
  classCode: string;
  codeSource?: "manual" | "generated";
};

const MAX_CODE_ATTEMPTS = 5;
const DUPLICATE_CODE_MESSAGE =
  "That class code is already in use. Please choose a different code.";
const GENERATION_EXHAUSTED_MESSAGE =
  "Couldn't generate a unique code. Try again or enter one manually.";

type UniqueCodeResult = { ok: true; code: string } | { ok: false; message: string };

/**
 * Picks a random code not used by any class. Must run with the admin client:
 * the request client only sees the teacher's own classes under RLS.
 */
async function findUnusedClassCode(admin: SupabaseClient): Promise<UniqueCodeResult> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomClassCode();
    const { exists, error } = await findClassByCode(admin, code);
    if (error) return { ok: false, message: DATABASE_RETRY_MESSAGE };
    if (!exists) return { ok: true, code };
  }
  return { ok: false, message: GENERATION_EXHAUSTED_MESSAGE };
}

export async function generateClassCode(): Promise<UniqueCodeResult> {
  try { await requireTeacherId(); } catch {
    return { ok: false, message: "An approved, verified teacher session is required." };
  }
  try {
    return await findUnusedClassCode(createAdminClient());
  } catch {
    return { ok: false, message: DATABASE_RETRY_MESSAGE };
  }
}

export async function createClass(input: CreateClassInput): Promise<
  | { ok: true; classId: string; classCode: string }
  | { ok: false; message: string; field?: "classCode" }
> {
  const name = typeof input.className === "string" ? input.className.trim() : "";
  if (!name) return { ok: false, message: "Class name is required." };

  const codeSource = input.codeSource === "generated" ? "generated" : "manual";
  const rawCode = typeof input.classCode === "string" ? input.classCode : "";
  let class_code = normalizeClassCode(rawCode);
  if (!isValidClassCode(class_code)) {
    return {
      ok: false,
      field: "classCode",
      message: "Class code must be exactly 6 letters or digits (e.g. A1B2C3).",
    };
  }

  const section = typeof input.section === "string" ? input.section.trim() : "";

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, message: "You must be logged in to create a class." };
  }

  // Fast, friendly pre-check. The DB's unique constraint on class_code is the
  // actual source of truth (see the insert error handling below), so this
  // can't be bypassed by a concurrent submission slipping past this check.
  const { exists, error: lookupError } = await findClassByCode(supabase, class_code);
  if (lookupError) {
    return { ok: false, message: DATABASE_RETRY_MESSAGE };
  }
  if (exists) {
    return { ok: false, field: "classCode", message: DUPLICATE_CODE_MESSAGE };
  }

  try { await requireTeacherId(); } catch {
    return { ok: false, message: "An approved, verified teacher session is required." };
  }
  const admin = createAdminClient();

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const { data, error } = await insertClass(admin, {
      teacher_id: userData.user.id,
      name,
      section,
      class_code,
    });

    if (data && !error) return { ok: true, classId: data.id, classCode: data.class_code };

    if (!error || !isDuplicateClassCodeError(error)) {
      return { ok: false, message: DATABASE_RETRY_MESSAGE };
    }
    if (codeSource === "manual") {
      return { ok: false, field: "classCode", message: DUPLICATE_CODE_MESSAGE };
    }

    // A generated code was taken between generation and insert; pick a fresh one.
    const next = await findUnusedClassCode(admin);
    if (!next.ok) return { ok: false, field: "classCode", message: next.message };
    class_code = next.code;
  }

  return { ok: false, field: "classCode", message: GENERATION_EXHAUSTED_MESSAGE };
}
