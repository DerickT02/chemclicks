'use server';

import { createClient } from "@/lib/supabase/server";
import { insertClass } from "@/lib/db/classes";

type CreateClassInput = {
  className: string;
  classCode: number;
};

export async function createClass(input: CreateClassInput): Promise<
  | { ok: true; classId: string }
  | { ok: false; message: string }
> {
  const name = input.className.trim();
  if (!name) return { ok: false, message: "Class name is required." };

  if (!Number.isInteger(input.classCode)) {
    return { ok: false, message: "Class code must be a 6-digit number." };
  }

  if (input.classCode < 100_000 || input.classCode > 999_999) {
    return { ok: false, message: "Class code must be 6 digits (100000–999999)." };
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, message: "You must be logged in to create a class." };
  }

  const { data, error } = await insertClass(supabase, {
    teacher_id: userData.user.id,
    name,
    section: "",
    class_code: String(input.classCode),
  });

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Failed to create class." };
  }

  return { ok: true, classId: data.id };
}

