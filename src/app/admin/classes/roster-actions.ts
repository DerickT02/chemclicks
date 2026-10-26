"use server";

import { revalidatePath } from "next/cache";
import { approveOwnedStudent, approveOwnedStudents } from "@/lib/server/student-roster";

export type ApprovalState = { status: "idle" | "success" | "error"; message: string };

const INVALID_REQUEST: ApprovalState = { status: "error", message: "Invalid approval request. Refresh the roster and try again." };

export async function approveStudent(_previous: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const classId = formData.get("class_id");
  if (typeof classId !== "string") return INVALID_REQUEST;
  try {
    if (formData.get("intent") === "approve_all") {
      const studentIds = formData.getAll("pending_id");
      if (studentIds.length === 0 || !studentIds.every(id => typeof id === "string")) return INVALID_REQUEST;
      const approved = await approveOwnedStudents(classId, studentIds as string[]);
      revalidatePath("/admin");
      return { status: "success", message: `${approved} ${approved === 1 ? "student" : "students"} approved. They can now sign in.` };
    }
    const studentId = formData.get("student_id");
    if (typeof studentId !== "string") return INVALID_REQUEST;
    await approveOwnedStudent(classId, studentId);
    revalidatePath("/admin");
    return { status: "success", message: "Student approved. They can now sign in." };
  } catch {
    return { status: "error", message: "Approval could not be confirmed. Refresh the roster and try again. Only the class's verified teacher can approve students." };
  }
}
