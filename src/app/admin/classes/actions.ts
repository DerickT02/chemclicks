"use server";

import { revalidatePath } from "next/cache";
import { disableOwnedClass } from "@/lib/server/classes";

export type DisableClassState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function disableClass(
  _previousState: DisableClassState,
  formData: FormData,
): Promise<DisableClassState> {
  const classId = formData.get("class_id");
  if (typeof classId !== "string"
    || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(classId)
    || formData.get("confirmation") !== "disable") {
    return { status: "error", message: "Select a valid class and confirm disabling it." };
  }

  try {
    await disableOwnedClass(classId);
  } catch {
    return {
      status: "error",
      message: "We could not confirm the class was disabled. Refresh the page before trying again.",
    };
  }

  try {
    revalidatePath("/admin", "layout");
    revalidatePath("/student", "layout");
  } catch {
    // The flag update was confirmed. A cache failure must not invite a repeat write.
    return { status: "success", message: "Class disabled. Refresh the page to update classrooms." };
  }
  return { status: "success", message: "Class disabled. Classroom data has been kept." };
}
