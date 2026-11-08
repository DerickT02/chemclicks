"use client";

import { useLiveClassroom } from "@/app/admin/LiveClassroomProvider";
import StudentRoster from "@/app/admin/classes/StudentRoster";
import RefreshAssignments from "@/components/assignments/RefreshAssignments";

type Props = { classId: string };

/** The class roster from the shared live classroom read. */
export default function LiveStudentRoster({ classId }: Props) {
  const classroom = useLiveClassroom();
  const roster = classroom?.roster ?? null;

  if (!roster) {
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
      roster={roster}
      liveStatus={classroom?.failed
        ? "Live updates interrupted. Showing last loaded roster; retrying automatically."
        : "Student approval requests update live, with periodic checks while this tab is visible."}
    />
  );
}
