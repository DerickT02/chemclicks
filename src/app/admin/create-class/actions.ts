'use server';

import { createClient } from "@/lib/supabase/server";
import { findClassByCode, insertClass, isDuplicateClassCodeError } from "@/lib/db/classes";
import { DATABASE_RETRY_MESSAGE } from "@/lib/errors/user-facing-errors";

type CreateClassInput = {
  className: string;
  section: string;
  classCode: string;
};

const CLASS_CODE_PATTERN = /^[A-Za-z0-9]{6}$/;
const DUPLICATE_CODE_MESSAGE =
  "That class code is already in use. Please choose a different code.";

export async function createClass(input: CreateClassInput): Promise<
  | { ok: true; classId: string }
  | { ok: false; message: string; field?: "classCode" }
> {
  const name = input.className.trim();
  if (!name) return { ok: false, message: "Class name is required." };

  const rawCode = input.classCode.trim();
  if (!CLASS_CODE_PATTERN.test(rawCode)) {
    return {
      ok: false,
      field: "classCode",
      message: "Class code must be exactly 6 letters or digits (e.g. A1B2C3).",
    };
  }

  const class_code = rawCode.toUpperCase();
  const section = input.section.trim();

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

  const { data, error } = await insertClass(supabase, {
    teacher_id: userData.user.id,
    name,
    section,
    class_code,
  });

  if (error || !data) {
    if (error && isDuplicateClassCodeError(error)) {
      return { ok: false, field: "classCode", message: DUPLICATE_CODE_MESSAGE };
    }
    return { ok: false, message: DATABASE_RETRY_MESSAGE };
  }

  return { ok: true, classId: data.id };
}
