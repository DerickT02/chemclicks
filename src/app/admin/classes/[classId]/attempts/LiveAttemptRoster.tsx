"use client";

import { AttemptRoster } from "@/app/admin/classes/[classId]/attempts/AttemptRoster";
import { useLiveTeacherProgress } from "@/components/assignments/useLiveTeacherProgress";
import type { TeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";

export function LiveAttemptRoster({ initialSummary }: { initialSummary: TeacherActivityAttemptSummary }) {
  const { data, failed } = useLiveTeacherProgress(
    `/admin/classes/${encodeURIComponent(initialSummary.classId)}/progress?assignmentId=${encodeURIComponent(initialSummary.assignmentId)}`,
    initialSummary,
  );

  return (
    <>
      <p role="status" className="mb-3 text-sm text-muted-foreground">
        {failed
          ? "Live updates interrupted. Showing last loaded attempts; retrying automatically."
          : "Attempts update automatically every 5 seconds while this tab is visible."}
      </p>
      {data && <AttemptRoster summary={data} />}
    </>
  );
}
