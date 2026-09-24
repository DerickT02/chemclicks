import type { ActivityType } from "@/lib/db/activities";

export function hasActivityContent(type: ActivityType): boolean {
  return type === "lewis_diagram"
    || type === "lewis_structures_ionic"
    || type === "lewis_structures_covalent"
    || type === "measurement_ruler_tenths"
    || type === "measurement_ruler_hundredths"
    || type === "measurement_graduated_cylinder";
}
