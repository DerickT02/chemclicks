"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherId } from "@/lib/server/teacher";
import {
  archiveClassActivity,
  insertClassActivity,
  updateClassActivity,
} from "@/lib/db/class_activities";
import { getNewAssignmentBlockReason } from "@/lib/activities/registry";
import { parseUtcInput, scheduleChangeInterruptsWork } from "@/lib/assignments/schedule";
import type { ClassActivity } from "@/lib/db/class_activities";

export type AssignmentFormState = {
  status: "idle" | "success" | "error";
  message: string;
  requiresConfirmation?: boolean;
  savedAssignment?: Pick<ClassActivity, "id" | "class_id" | "activity_id" | "opens_at" | "closes_at">;
};

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function saveAssignment(_previousState: AssignmentFormState, formData: FormData): Promise<AssignmentFormState> {
  const classId = readString(formData, "class_id");
  const activityId = readString(formData, "activity_id");
  const assignmentId = readString(formData, "assignment_id");
  let opensAt: string | null;
  let closesAt: string | null;

  if (!isUuid(classId) || !isUuid(activityId) || (assignmentId !== "" && !isUuid(assignmentId))) {
    return {
      status: "error",
      message: "Select a valid class and activity.",
    };
  }

  try {
    opensAt = parseUtcInput(readString(formData, "opens_at"));
    closesAt = parseUtcInput(readString(formData, "closes_at"));
  } catch {
    return { status: "error", message: "Enter valid opening and closing dates." };
  }

  if (opensAt && closesAt && opensAt >= closesAt) {
     return {
       status: "error",
       message: "The opening date must be earlier than the closing date.",
     };
   }

   let savedAssignment: AssignmentFormState["savedAssignment"];
   try {
     const supabase = await createClient();
     const { data: authData, error: authError } = await supabase.auth.getUser();

     if (authError || !authData.user) {
       return {
         status: "error",
         message: "Please sign in again.",
       };
     }

     const { data: ownedClass, error: classError } = await supabase
       .from("classes")
       .select("id")
       .eq("id", classId)
       .eq("teacher_id", authData.user.id)
       .eq("is_active", true)
       .maybeSingle();

     if (classError || !ownedClass) {
       return {
         status: "error",
         message: "You cannot manage assignments for this class.",
       };
     }

     let expected: Pick<ClassActivity, "class_id" | "activity_id" | "opens_at" | "closes_at"> | undefined;
     if (assignmentId) {
       const { data: assignment, error } = await supabase
         .from("class_activities")
         .select("id, opens_at, closes_at")
         .eq("id", assignmentId)
         .eq("class_id", classId)
         .eq("activity_id", activityId)
         .is("archived_at", null)
         .maybeSingle();

       if (error || !assignment) {
         return {
           status: "error",
           message: "Assignment not found or you do not have access.",
         };
       }
       if (formData.has("original_opens_at") || formData.has("original_closes_at")) {
         if (!formData.has("original_opens_at") || !formData.has("original_closes_at")
           || (readString(formData, "original_opens_at") || null) !== assignment.opens_at
           || (readString(formData, "original_closes_at") || null) !== assignment.closes_at) {
           return { status: "error", message: "The schedule changed. Refresh the page, then reopen the editor before trying again." };
         }
         expected = { class_id: classId, activity_id: activityId, opens_at: assignment.opens_at, closes_at: assignment.closes_at };
       }
       if (scheduleChangeInterruptsWork(assignment, { opens_at: opensAt, closes_at: closesAt }, Date.now())
         && readString(formData, "confirm_schedule_change") !== "true") {
         return { status: "error", message: "These dates interrupt currently open work. Confirm saving before continuing.", requiresConfirmation: true };
       }
       // Preserve original sub-millisecond precision when an input's instant is unchanged.
       if (opensAt !== null && assignment.opens_at && Date.parse(opensAt) === Date.parse(assignment.opens_at)) opensAt = assignment.opens_at;
       if (closesAt !== null && assignment.closes_at && Date.parse(closesAt) === Date.parse(assignment.closes_at)) closesAt = assignment.closes_at;
     } else {
       const { data: activity, error } = await supabase
         .from("activities")
         .select("id, type")
         .eq("id", activityId)
         .maybeSingle();

       if (error || !activity) {
         return {
           status: "error",
           message: "The selected activity is unavailable.",
         };
       }

       // Derive support from the stored activity, never a browser-supplied type or flag.
       const blockReason = typeof activity.type === "string"
         ? getNewAssignmentBlockReason(activity.type)
         : "The selected activity is unavailable.";
       if (blockReason !== null) return { status: "error", message: blockReason };
     }

     await requireTeacherId();
     const writer = createAdminClient();
     const result = assignmentId
           ? await updateClassActivity(writer, assignmentId, {
               opens_at: opensAt,
               closes_at: closesAt,
             }, expected)
           : await insertClassActivity(writer, {
               class_id: classId,
               activity_id: activityId,
               opens_at: opensAt,
               closes_at: closesAt,
             });

         if (result.error) {
           const { code, message } = result.error;

           return {
             status: "error",
             message:
               code === "VALIDATION_ERROR" || code === "NOT_FOUND" || code === "CONFLICT"
                 ? message
                 : code === "23505"
                   ? "This activity is already assigned. Use Edit dates on its assignment card."
                   : code === "23514"
                     ? "The dates or assignment values are invalid."
                     : code === "23503"
                       ? "The class or activity no longer exists."
                       : "The assignment could not be saved. Please try again.",
           };
         }

         if (!result.data) {
           return {
             status: "error",
             message: "The assignment could not be saved.",
           };
         }
         savedAssignment = {
           id: result.data.id, class_id: result.data.class_id, activity_id: result.data.activity_id,
           opens_at: result.data.opens_at, closes_at: result.data.closes_at,
         };
       } catch {
         return {
           status: "error",
           message: "The assignment could not be saved. Please try again.",
         };
       }

       try {
         revalidatePath("/admin");
         revalidatePath("/student", "layout");
       } catch {
         return { status: "success", message: "Saved. Refresh the page to update the schedule.", savedAssignment };
       }

       return {
         status: "success",
         message: assignmentId ? "Dates updated." : "Activity assigned.",
         savedAssignment,
       };
     }

export async function unassignActivity(
  _previousState: AssignmentFormState,
  formData: FormData,
): Promise<AssignmentFormState> {
  const classId = readString(formData, "class_id");
  const assignmentId = readString(formData, "assignment_id");

  if (!isUuid(classId) || !isUuid(assignmentId)) {
    return {
      status: "error",
      message: "This assignment could not be removed.",
    };
  }

  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return {
        status: "error",
        message: "Please sign in again.",
      };
    }

    const { data: ownedClass, error: classError } = await supabase
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("teacher_id", authData.user.id)
      .maybeSingle();

    if (classError || !ownedClass) {
      return {
        status: "error",
        message: "You cannot manage assignments for this class.",
      };
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from("class_activities")
      .select("id, archived_at")
      .eq("id", assignmentId)
      .eq("class_id", classId)
      .maybeSingle();

    if (assignmentError || !assignment || assignment.archived_at) {
      return {
        status: "error",
        message: "Assignment not found or you do not have access.",
      };
    }

    await requireTeacherId();
    const writer = createAdminClient();
    const result = await archiveClassActivity(writer, assignmentId);

    if (result.error) {
      const { code, message } = result.error;
      return {
        status: "error",
        message:
          code === "VALIDATION_ERROR" || code === "NOT_FOUND"
            ? message
            : "The assignment could not be archived. Please try again.",
      };
    }

    if (!result.data) {
      return {
        status: "error",
        message: "The assignment could not be archived.",
      };
    }
  } catch {
    return {
      status: "error",
      message: "The assignment could not be archived. Please try again.",
    };
  }

  revalidatePath("/admin");

  return {
    status: "success",
    message:
      "Activity archived. Attempt history remains under Activity attempts. Assign again to start a new assignment.",
  };
}
