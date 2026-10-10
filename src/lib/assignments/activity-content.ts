import { getActivityDefinition } from "@/lib/activities/registry";

/** Existing exercise/participation access is separate from allowing a new assignment. */
export function hasActivityContent(type: string): boolean {
  return Boolean(getActivityDefinition(type)?.explorer);
}
