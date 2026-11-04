"use client";

import { useState } from "react";
import { AttemptHistoryTable } from "@/app/admin/classes/[classId]/attempts/AttemptHistoryTable";
import { useLiveTeacherProgress } from "@/components/assignments/useLiveTeacherProgress";
import type { TeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";

type Props = {
  classId: string;
  assignmentId: string;
  student: TeacherActivityAttemptSummary["students"][number];
};

export function LazyAttemptHistory({ classId, assignmentId, student }: Props) {
  const [open, setOpen] = useState(false);
  const query = new URLSearchParams({ assignmentId, studentId: student.studentId });
  const { data, failed } = useLiveTeacherProgress<typeof student.attempts>(
    `/admin/classes/${encodeURIComponent(classId)}/attempt-history?${query}`,
    null,
    { classId, assignmentId, enabled: open },
  );

  return (
    <details className="mt-3" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-sm underline">View attempt history for {student.firstName} {student.lastName}</summary>
      {open && (
        <>
          {failed && <p role="status" className="mt-3 text-sm text-muted-foreground">{data ? "Showing last loaded history; retrying automatically." : "Loading attempt history; unavailable reads retry automatically."}</p>}
          {data && <AttemptHistoryTable firstName={student.firstName} lastName={student.lastName} attempts={data} />}
        </>
      )}
    </details>
  );
}
