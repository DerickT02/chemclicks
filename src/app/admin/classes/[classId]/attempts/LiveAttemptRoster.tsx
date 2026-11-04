"use client";

import { AttemptRoster } from "@/app/admin/classes/[classId]/attempts/AttemptRoster";
import { useLiveTeacherProgress } from "@/components/assignments/useLiveTeacherProgress";
import type { TeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";

export function LiveAttemptRoster({ initialSummary }: { initialSummary: TeacherActivityAttemptSummary }) {
  const { data, failed } = useLiveTeacherProgress(
    `/admin/classes/${encodeURIComponent(initialSummary.classId)}/progress?assignmentId=${encodeURIComponent(initialSummary.assignmentId)}`,
    initialSummary,
    { classId: initialSummary.classId, assignmentId: initialSummary.assignmentId },
  );

  return (
    <>
      <p role="status" className="mb-3 text-sm text-muted-foreground">
        {failed
          ? "Live updates interrupted. Showing last loaded attempts; retrying automatically."
          : "Attempts update live, with periodic checks while this tab is visible."}
      </p>
      {data && <AttemptRoster summary={data} lazyHistory />}
    </>
  );
}
