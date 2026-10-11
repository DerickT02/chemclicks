"use client";

import type { ActivityCatalogEntry } from "@/lib/db/activities";

type Props = {
  /** Activities the teacher can still assign (already-assigned entries excluded). */
  activities: ActivityCatalogEntry[];
  /** Full catalog size; used when `activities` is empty to distinguish “all assigned” vs empty catalog. */
  totalCatalogCount: number;
  selectedActivityId: string;
  onSelect: (activityId: string) => void;
};

export default function ActivityCatalog({
  activities,
  totalCatalogCount,
  selectedActivityId,
  onSelect,
}: Props) {
  if (activities.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        {totalCatalogCount > 0
          ? "All catalog activities are already assigned to this class. Adjust schedules in the assigned list below."
          : "No activities are available to assign."}
      </p>
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">
        Choose an activity
        {totalCatalogCount > activities.length ? (
          <span className="ml-2 font-normal text-muted-foreground">
            ({activities.length} of {totalCatalogCount} available)
          </span>
        ) : null}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {activities.map((activity) => {
          const isSelected = selectedActivityId === activity.id;
          const descriptionId = `activity-${activity.id}-description`;

          return (
            <label
              key={activity.id}
              className={`relative flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-border bg-background/40 hover:border-ring"
              }`}
            >
              <input
                type="radio"
                name="activity_id"
                value={activity.id}
                checked={isSelected}
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
                    {activity.category}
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
