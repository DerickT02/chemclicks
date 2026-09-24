'use server';

import { createServiceClient } from "@/lib/server/database";
import { requireTeacherId } from "@/lib/server/teacher";
import { insertClass } from "@/lib/db/classes";

type CreateClassInput = {
  className: string;
  section: string;
  classCode: string;
};

const CLASS_CODE_PATTERN = /^[A-Za-z0-9]{6}$/;

export async function createClass(input: CreateClassInput): Promise<
  | { ok: true; classId: string }
  | { ok: false; message: string }
> {
  const name = input.className.trim();
  if (!name) return { ok: false, message: "Class name is required." };

  const rawCode = input.classCode.trim();
  if (!CLASS_CODE_PATTERN.test(rawCode)) {
    return {
      ok: false,
      message: "Class code must be exactly 6 letters or digits (e.g. A1B2C3).",
    };
  }

  const class_code = rawCode.toUpperCase();
  const section = input.section.trim();

  let teacherId: string;
  try {
    teacherId = await requireTeacherId();
  } catch {
    return { ok: false, message: "An approved, verified teacher session is required." };
  }
  const supabase = createServiceClient();

  const { data, error } = await insertClass(supabase, {
    teacher_id: teacherId,
    name,
    section,
    class_code,
  });

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Failed to create class." };
  }

  return { ok: true, classId: data.id };
}
