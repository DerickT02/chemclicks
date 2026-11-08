"use client";

import { useMemo } from "react";
import { StudentProgressRoster } from "@/app/admin/classes/[classId]/activities/[assignmentId]/StudentProgressRoster";
import RefreshAssignments from "@/components/assignments/RefreshAssignments";
import { useLiveTeacherProgress } from "@/components/assignments/useLiveTeacherProgress";
import { ASSIGNMENT_STAGES, type AssignmentStage } from "@/lib/assignments/stages";
import { classSnapshotCursor, mergeClassSnapshot, type TeacherClassSnapshot } from "@/lib/teacher-class-snapshot";
import type { TeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";

// Furthest along first, matching the bar.
const STAGE_ORDER: AssignmentStage[] = [
  "completed", "needs_retry", "quiz_in_progress", "explored", "exploring", "not_started",
];

/** One activity's class progress, kept current by revision-based live reads. */
export function LiveStudentProgress({ initialSummary }: { initialSummary: TeacherActivityAttemptSummary }) {
  const initial = useMemo<TeacherClassSnapshot>(() => ({
    classId: initialSummary.classId, revision: null, reset: true, removedStudentIds: [],
    roster: null, progress: null, attempts: initialSummary,
  }), [initialSummary]);
  const { data, failed } = useLiveTeacherProgress(
    `/admin/classes/${encodeURIComponent(initialSummary.classId)}/updates?assignmentId=${encodeURIComponent(initialSummary.assignmentId)}`,
    initial,
    { classId: initialSummary.classId, assignmentId: initialSummary.assignmentId,
      getCursor: classSnapshotCursor, merge: mergeClassSnapshot },
  );
  const summary = data?.attempts ?? initialSummary;

  const stages = summary.students.map(student => student.progress.stage);
  const counts = STAGE_ORDER
    .map(stage => ({ stage, count: stages.filter(item => item === stage).length }))
    .filter(item => item.count > 0);
  const completed = stages.filter(stage => stage === "completed").length;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="status">
          {summary.students.length === 0
            ? "No students enrolled yet."
            : <>
              <span className="font-semibold text-foreground">{completed} of {summary.students.length}</span> completed
              {counts.filter(item => item.stage !== "completed")
                .map(item => ` · ${item.count} ${ASSIGNMENT_STAGES[item.stage].label.toLowerCase()}`).join("")}
            </>}
        </p>
        <RefreshAssignments label="Refresh progress" refreshOnFocus={false} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {failed
          ? "Live updates interrupted. Showing last loaded progress; retrying automatically."
          : "Progress updates live, with periodic checks while this tab is visible."}
      </p>
      <div className="mt-4">
        <StudentProgressRoster summary={summary} lazyHistory />
      </div>
    </>
  );
}
