import type { TeacherClassLessonProgress, LessonStatus } from "@/lib/server/teacher-lesson-progress";
import { AssignmentProgressDetails } from "@/components/assignments/AssignmentProgressDetails";
import { ASSIGNMENT_STAGES, type AssignmentStage } from "@/lib/assignments/stages";

// Used when the database has not been migrated to return a stage yet.
const STAGE_FROM_STATUS: Record<LessonStatus, AssignmentStage> = {
  not_started: "not_started",
  in_progress: "exploring",
  completed: "completed",
};

type Student = TeacherClassLessonProgress["students"][number];
type Lesson = Student["lessons"][number];

function lessonStage(lesson: Lesson): AssignmentStage {
  return lesson.stage ?? STAGE_FROM_STATUS[lesson.status];
}

export function LessonProgressList({ students }: { students: Student[] }) {
  if (students.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
        No students in this class yet.
      </p>
    );
  }

  return (
    <ul className="space-y-6">
      {students.map((student) => {
        const completedCount = student.lessons.filter(
          (lesson) => lessonStage(lesson) === "completed",
        ).length;
        return (
          <li key={student.studentId} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">
                {student.firstName} {student.lastName}
              </p>
              {student.lessons.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {completedCount} of {student.lessons.length} completed
                </p>
              ) : null}
            </div>

            {student.lessons.length === 0 ? (
              <p className="text-xs text-muted-foreground">No lessons assigned yet.</p>
            ) : (
              <ul className="space-y-3">
                {student.lessons.map((lesson) => {
                  const stageKey = lessonStage(lesson);
                  const stage = ASSIGNMENT_STAGES[stageKey];
                  const name = `${student.firstName} ${student.lastName}, ${lesson.activityTitle}`;
                  return (
                    <li key={lesson.assignmentId} className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                        <span className="font-medium text-foreground">{lesson.activityTitle}</span>
                        <span className={stage.className}>
                          {stage.label} · {stage.percent}%
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={name}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={stage.percent}
                        aria-valuetext={stage.label}
                        className="h-2 rounded-full bg-muted"
                      >
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${stage.percent}%` }}
                        />
                      </div>
                      {lesson.stage && stageKey !== "not_started" ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground underline-offset-4 hover:underline">
                            Timing and results<span className="sr-only"> for {name}</span>
                          </summary>
                          <AssignmentProgressDetails
                            className="mt-2 space-y-1 text-xs text-muted-foreground"
                            facts={{
                              stage: stageKey,
                              explorationStartedAt: lesson.explorationStartedAt ?? null,
                              firstQuizStartedAt: lesson.firstQuizStartedAt ?? null,
                              timeToFirstQuizSeconds: lesson.timeToFirstQuizSeconds ?? null,
                              passingQuizAttemptNumber: lesson.passingQuizAttemptNumber ?? null,
                              passingQuizScore: lesson.passingQuizScore ?? null,
                              passingQuizTotal: lesson.passingQuizTotal ?? null,
                              passingQuizPercentage: lesson.passingQuizPercentage ?? null,
                              failedQuizAttemptCount: lesson.failedQuizAttemptCount ?? 0,
                              completedAt: lesson.completedAt ?? null,
                            }}
                          />
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
