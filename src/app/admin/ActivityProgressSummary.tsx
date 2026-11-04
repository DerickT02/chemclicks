import Link from "next/link";
import type { TeacherClassLessonProgress, LessonStatus } from "@/lib/server/teacher-lesson-progress";
import type { AssignmentStage } from "@/lib/assignments/stages";

// Used when the database has not been migrated to return a stage yet.
const STAGE_FROM_STATUS: Record<LessonStatus, AssignmentStage> = {
  not_started: "not_started",
  in_progress: "exploring",
  completed: "completed",
};

// How the class's stages are counted on an activity card, furthest along first.
const BUCKETS: { label: string; stages: AssignmentStage[] }[] = [
  { label: "completed", stages: ["completed"] },
  { label: "needs retry", stages: ["needs_retry"] },
  { label: "taking the quiz", stages: ["quiz_in_progress"] },
  { label: "exploring", stages: ["exploring", "explored"] },
  { label: "not started", stages: ["not_started"] },
];

type Student = TeacherClassLessonProgress["students"][number];

type Props = {
  classId: string;
  assignmentId: string;
  activityTitle: string;
  /** The class's progress, or null when it could not be loaded. */
  students: Student[] | null;
};

/** The class's stage counts for one assigned activity, linking to its progress page. */
export function ActivityProgressSummary({ classId, assignmentId, activityTitle, students }: Props) {
  const href = `/admin/classes/${classId}/activities/${assignmentId}`;
  const stages = students?.map((student) => {
    const lesson = student.lessons.find((item) => item.assignmentId === assignmentId);
    return lesson ? lesson.stage ?? STAGE_FROM_STATUS[lesson.status] : "not_started";
  });
  const counts = stages
    ? BUCKETS.map((bucket) => ({
      label: bucket.label,
      count: stages.filter((stage) => bucket.stages.includes(stage)).length,
    })).filter((bucket) => bucket.count > 0)
    : [];

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">
        {stages === undefined
          ? "Progress unavailable."
          : stages.length === 0
            ? "No students in this class yet."
            : <>
              {stages.length} {stages.length === 1 ? "student" : "students"}
              {counts.map((bucket) => ` · ${bucket.count} ${bucket.label}`).join("")}
            </>}
      </p>
      <Link
        href={href}
        prefetch={false}
        className="inline-flex rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Student progress<span className="sr-only">: {activityTitle}</span>
      </Link>
    </div>
  );
}
