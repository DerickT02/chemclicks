"use client";

import type { ActivityCatalogEntry } from "@/lib/db/activities";

type Props = {
  activities: ActivityCatalogEntry[];
  assignedActivityIds: readonly string[];
  selectedActivityId: string;
  onSelect: (activityId: string) => void;
};

export default function ActivityCatalog({
  activities,
  assignedActivityIds,
  selectedActivityId,
  onSelect,
}: Props) {
  if (activities.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No activities are available to assign.
      </p>
    );
  }

  const assignedIds = new Set(assignedActivityIds);

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">
        Choose an activity
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {activities.map((activity) => {
          const isAssigned = assignedIds.has(activity.id);
          const isSelected = selectedActivityId === activity.id;
          const descriptionId = `activity-${activity.id}-description`;

          return (
            <label
              key={activity.id}
              className={`relative flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-border bg-background/40 hover:border-ring"
              } ${isAssigned ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="radio"
                name="activity_id"
                value={activity.id}
                checked={isSelected}
                disabled={isAssigned}
                aria-describedby={descriptionId}
                onChange={() => onSelect(activity.id)}
                className="mt-1 size-4 shrink-0 accent-accent"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {activity.title}
                  </span>
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {isAssigned ? "Assigned" : activity.category}
                  </span>
                </span>
                <span
                  id={descriptionId}
                  className="mt-1 block text-xs leading-relaxed text-muted-foreground"
                >
                  {activity.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
