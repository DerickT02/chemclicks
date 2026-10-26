import type { StudentAssignment } from "@/lib/db/student-assignments";
import type { ProgressStatus } from "@/lib/db/student_progress";
import { hasActivityContent } from "@/lib/assignments/activity-content";
import { scheduleStatus } from "@/lib/assignments/schedule";

export type QueueAssignment = StudentAssignment & {
  progress: ProgressStatus | null;
  /** The earlier section the student must finish first; absent or null when unlocked. */
  lockedBy?: { id: string; activity: { title: string } } | null;
};
export const QUEUE_SECTIONS = [
  { id: "in_progress", title: "In progress" },
  { id: "not_started", title: "To do" },
  { id: "completed", title: "Completed explorations" },
  { id: "unknown", title: "Available — progress unavailable" },
  { id: "unsupported", title: "Exercise unavailable" },
  { id: "upcoming", title: "Upcoming" },
  { id: "closed", title: "Closed" },
  { id: "invalid", title: "Schedule unavailable" },
] as const;
export type QueueSection = typeof QUEUE_SECTIONS[number]["id"];

export function queueSection(assignment: QueueAssignment, now: number): QueueSection {
  const status = scheduleStatus(assignment, now);
  if (status === "Schedule unavailable") return "invalid";
  if (status === "Closed") return "closed";
  if (status === "Scheduled") return "upcoming";
  if (!hasActivityContent(assignment.activity.type)) return "unsupported";
  return assignment.progress ?? "unknown";
}

/** Earliest deadlines first for available work; earliest opening first for upcoming work. */
export function groupWorkQueue(assignments: readonly QueueAssignment[], now: number) {
  return QUEUE_SECTIONS.map(section => ({
    ...section,
    assignments: assignments.filter(assignment => queueSection(assignment, now) === section.id)
      .sort((a, b) => {
        const date = (assignment: QueueAssignment) => {
          const value = section.id === "upcoming" ? assignment.opens_at : assignment.closes_at;
          return value === null || !Number.isFinite(Date.parse(value)) ? Infinity : Date.parse(value);
        };
        return (date(a) - date(b)) || a.activity.order_index - b.activity.order_index || a.id.localeCompare(b.id);
      }),
  })).filter(section => section.assignments.length > 0);
}
