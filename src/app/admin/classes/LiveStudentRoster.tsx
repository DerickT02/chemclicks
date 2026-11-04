"use client";

import { useLiveClassroom } from "@/app/admin/LiveClassroomProvider";
import StudentRoster from "@/app/admin/classes/StudentRoster";
import RefreshAssignments from "@/components/assignments/RefreshAssignments";
import { useLiveTeacherProgress } from "@/components/assignments/useLiveTeacherProgress";
import type { StudentRoster as Roster } from "@/lib/server/student-roster";

type Props = { classId: string; initialRoster: Roster | null };

export default function LiveStudentRoster({ classId, initialRoster }: Props) {
  const shared = useLiveClassroom();
  const standalone = useLiveTeacherProgress(
    `/admin/classes/${encodeURIComponent(classId)}/roster`,
    initialRoster,
    { classId, resource: "roster", enabled: !shared },
  );
  const data = shared ? shared.data?.roster ?? initialRoster : standalone.data;
  const failed = shared ? shared.failed || !data : standalone.failed;

  if (!data) {
    return (
      <section aria-label="Students & approvals" className="mt-7 space-y-3">
        <h3 className="text-lg font-semibold">Students & approvals</h3>
        <p role="alert" className="text-sm text-destructive">
          Student roster could not be loaded. Retrying automatically.
        </p>
        <RefreshAssignments label="Retry student roster" refreshOnFocus={false} />
      </section>
    );
  }

  return (
    <StudentRoster
      classId={classId}
      roster={data}
      liveStatus={failed
        ? "Live updates interrupted. Showing last loaded roster; retrying automatically."
        : "Student approval requests update live, with periodic checks while this tab is visible."}
    />
  );
}
