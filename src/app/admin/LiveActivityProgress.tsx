"use client";

import { ActivityProgressSummary } from "@/app/admin/ActivityProgressSummary";
import { useLiveClassroom } from "@/app/admin/LiveClassroomProvider";
import RefreshAssignments from "@/components/assignments/RefreshAssignments";

type SummaryProps = { classId: string; assignmentId: string; activityTitle: string };

/** An activity card's stage counts, kept current by the class's live read. */
export function LiveActivityProgressSummary({ classId, assignmentId, activityTitle }: SummaryProps) {
  const progress = useLiveClassroom()?.progress ?? null;
  return (
    <ActivityProgressSummary
      classId={classId}
      assignmentId={assignmentId}
      activityTitle={activityTitle}
      students={progress?.students ?? null}
    />
  );
}

/** Live-update state for the class's progress, with a retry while nothing has loaded. */
export function LiveProgressStatus() {
  const classroom = useLiveClassroom();
  const progress = classroom?.progress ?? null;
  if (!progress) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-destructive">
          Student progress could not be loaded. Retrying automatically.
        </p>
        <RefreshAssignments label="Retry student progress" refreshOnFocus={false} />
      </div>
    );
  }
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {classroom?.failed
        ? "Live updates interrupted. Showing last loaded progress; retrying automatically."
        : "Progress updates live, with periodic checks while this tab is visible."}
    </p>
  );
}
