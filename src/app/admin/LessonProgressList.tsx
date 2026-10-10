import type { TeacherClassLessonProgress, LessonStatus } from "@/lib/server/teacher-lesson-progress";

const STATUS_LABEL: Record<LessonStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

const STATUS_CLASS: Record<LessonStatus, string> = {
  not_started: "border-border bg-muted text-muted-foreground",
  in_progress: "border-ring bg-muted text-foreground",
  completed: "border-accent bg-accent/15 text-accent",
};

type Student = TeacherClassLessonProgress["students"][number];

export function LessonProgressList({ students }: { students: Student[] }) {
  if (students.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
        No students in this class yet.
      </p>
    );
  }

  return (
    <ul className="space-y-5">
      {students.map((student) => (
        <li key={student.studentId} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">
              {student.firstName} {student.lastName}
            </p>
            <p className="text-xs text-muted-foreground">
              {student.overallPercent}% complete
            </p>
          </div>

          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${student.overallPercent}%` }}
            />
          </div>

          {student.lessons.length === 0 ? (
            <p className="text-xs text-muted-foreground">No lessons assigned yet.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {student.lessons.map((lesson) => (
                <li
                  key={lesson.assignmentId}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[lesson.status]}`}
                >
                  {lesson.activityTitle}: {STATUS_LABEL[lesson.status]}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
