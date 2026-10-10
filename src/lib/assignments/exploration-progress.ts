import type { ProgressStatus } from "@/lib/db/student_progress";

export type CurrentExplorationSummary = {
  assigned: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  percent: number | null;
};

/** Current progress states, not ever-completed history or quiz grades. */
export function summarizeCurrentExplorations(
  assignmentIds: readonly string[],
  progress: readonly { class_activity_id: string; status: ProgressStatus }[],
): CurrentExplorationSummary | null {
  const assignments = new Set(assignmentIds);
  const states = new Map<string, ProgressStatus>();
  for (const row of progress) {
    if (!assignments.has(row.class_activity_id)) continue;
    if (!["not_started", "in_progress", "completed"].includes(row.status)) return null;
    const existing = states.get(row.class_activity_id);
    if (existing && existing !== row.status) return null; // Conflicting duplicates are not a trustworthy count.
    states.set(row.class_activity_id, row.status);
  }
  const completed = [...states.values()].filter(status => status === "completed").length;
  const inProgress = [...states.values()].filter(status => status === "in_progress").length;
  const assigned = assignments.size;
  return {
    assigned,
    completed,
    inProgress,
    notStarted: assigned - completed - inProgress,
    percent: assigned === 0 ? null : Math.round(completed / assigned * 100),
  };
}
