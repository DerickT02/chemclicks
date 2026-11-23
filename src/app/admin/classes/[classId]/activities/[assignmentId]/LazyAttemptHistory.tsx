"use client";

import { useState } from "react";
import { AttemptHistorySummary } from "@/app/admin/classes/[classId]/activities/[assignmentId]/AttemptHistorySummary";
import { AttemptHistoryTable } from "@/app/admin/classes/[classId]/activities/[assignmentId]/AttemptHistoryTable";
import { useLiveTeacherProgress } from "@/components/assignments/useLiveTeacherProgress";
import LoadingIcon from "@/components/ui/LoadingIcon";
import type { TeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";

type Props = {
  classId: string;
  assignmentId: string;
  student: TeacherActivityAttemptSummary["students"][number];
};

export function LazyAttemptHistory({ classId, assignmentId, student }: Props) {
  const [open, setOpen] = useState(false);
  const query = new URLSearchParams({ assignmentId, studentId: student.studentId });
  const { data, failed, status } = useLiveTeacherProgress<typeof student.attempts>(
    `/admin/classes/${encodeURIComponent(classId)}/attempt-history?${query}`,
    null,
    { classId, assignmentId, enabled: open },
  );

  return (
    <details className="group/history mt-3" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <AttemptHistorySummary firstName={student.firstName} lastName={student.lastName} attemptCount={student.attemptCount} />
      {open && (
        <>
          {status === "loading" && (
            <div role="status" aria-live="polite" className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
              <LoadingIcon className="size-10 shrink-0" />
              <span>Loading attempt history…</span>
            </div>
          )}
          {failed && <p role="status" className="mt-3 text-sm text-muted-foreground">{data ? "Showing last loaded history; retrying automatically." : "Attempt history could not be loaded. Retrying automatically."}</p>}
          {data && <AttemptHistoryTable firstName={student.firstName} lastName={student.lastName} attempts={data} />}
        </>
      )}
    </details>
  );
}
