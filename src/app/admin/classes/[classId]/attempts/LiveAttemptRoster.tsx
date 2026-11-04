"use client";

import { useMemo } from "react";
import { classSnapshotCursor, mergeClassSnapshot, type TeacherClassSnapshot } from "@/lib/teacher-class-snapshot";
import { AttemptRoster } from "@/app/admin/classes/[classId]/attempts/AttemptRoster";
import { useLiveTeacherProgress } from "@/components/assignments/useLiveTeacherProgress";
import type { TeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";

export function LiveAttemptRoster({ initialSummary }: { initialSummary: TeacherActivityAttemptSummary }) {
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

  return (
    <>
      <p role="status" className="mb-3 text-sm text-muted-foreground">
        {failed
          ? "Live updates interrupted. Showing last loaded attempts; retrying automatically."
          : "Attempts update live, with periodic checks while this tab is visible."}
      </p>
      {data?.attempts && <AttemptRoster summary={data.attempts} lazyHistory />}
    </>
  );
}
