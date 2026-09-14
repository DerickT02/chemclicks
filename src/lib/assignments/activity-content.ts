import type { ActivityType } from "@/lib/db/activities";

export function hasActivityContent(type: ActivityType): boolean {
  return type === "lewis_diagram"
    || type === "measurement_ruler_tenths"
    || type === "measurement_ruler_hundredths"
    || type === "measurement_graduated_cylinder";
}
