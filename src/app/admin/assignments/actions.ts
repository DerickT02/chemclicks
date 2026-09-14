"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { insertClassActivity, updateClassActivity } from "@/lib/db/class_activities";

export type AssignmentFormState = { status: "idle" | "success" | "error"; message: string; };

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function parseUtcInput(value: string): string | null {
  if (!value) return null;

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
    throw new Error("Invalid date.");
  }

  const normalized = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${normalized}Z`);

  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== normalized) {
    throw new Error("Invalid date.");
  }
  return date.toISOString();
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
    return {
      status: "error",
      message: "Enter valid opening and closing dates.",
    };
  }

  if (opensAt && closesAt && opensAt >= closesAt) {
     return {
       status: "error",
       message: "The opening date must be earlier than the closing date.",
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

     if (assignmentId) {
       const { data: assignment, error } = await supabase
         .from("class_activities")
         .select("id")
         .eq("id", assignmentId)
         .eq("class_id", classId)
         .eq("activity_id", activityId)
         .maybeSingle();

       if (error || !assignment) {
         return {
           status: "error",
           message: "Assignment not found or you do not have access.",
         };
       }
     } else {
       const { data: activity, error } = await supabase
         .from("activities")
         .select("id")
         .eq("id", activityId)
         .maybeSingle();

       if (error || !activity) {
         return {
           status: "error",
           message: "The selected activity is unavailable.",
         };
       }
     }

     const result = assignmentId
           ? await updateClassActivity(supabase, assignmentId, {
               opens_at: opensAt,
               closes_at: closesAt,
             })
           : await insertClassActivity(supabase, {
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
               code === "VALIDATION_ERROR" || code === "NOT_FOUND"
                 ? message
                 : code === "23505"
                   ? "This activity is already assigned. Edit its dates below."
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
       } catch {
         return {
           status: "error",
           message: "The assignment could not be saved. Please try again.",
         };
       }

       revalidatePath("/admin");

       return {
         status: "success",
         message: assignmentId ? "Dates updated." : "Activity assigned.",
       };
     }
