"use client";

import { useId, useMemo, useState } from "react";
import { StudentProgressRoster } from "@/app/admin/classes/[classId]/activities/[assignmentId]/StudentProgressRoster";
import { useLiveTeacherProgress } from "@/components/assignments/useLiveTeacherProgress";
import LoadingIcon from "@/components/ui/LoadingIcon";
import { classSnapshotCursor, mergeClassSnapshot, type TeacherClassSnapshot } from "@/lib/teacher-class-snapshot";
import type { TeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";

type Props = {
  assignmentId: string;
  initialSummary: TeacherActivityAttemptSummary;
};

/** One activity's class progress, kept current by revision-based live reads. */
export function LiveStudentProgress({ assignmentId, initialSummary }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchId = useId();
  const initial = useMemo<TeacherClassSnapshot | null>(() => initialSummary.assignmentId === assignmentId ? {
    classId: initialSummary.classId, revision: null, reset: true, removedStudentIds: [],
    roster: null, progress: null, attempts: initialSummary,
  } : null, [assignmentId, initialSummary]);
  const { data, failed, status } = useLiveTeacherProgress(
    `/admin/classes/${encodeURIComponent(initialSummary.classId)}/updates?assignmentId=${encodeURIComponent(assignmentId)}`,
    initial,
    { classId: initialSummary.classId, assignmentId,
      getCursor: classSnapshotCursor, merge: mergeClassSnapshot },
  );
  const summary = data?.attempts;

  const completed = summary?.students.filter(student => student.progress.stage === "completed").length;

  return (
    <>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-muted-foreground" role="status">
          {summary && (summary.students.length === 0
            ? "No students enrolled yet."
            : <>
              <span className="font-semibold text-foreground">{completed} of {summary.students.length}</span> completed
            </>)}
        </p>
        <div className="w-full sm:max-w-sm">
          <label htmlFor={searchId} className="mb-2 block text-sm font-medium text-foreground">Search students</label>
          <input
            id={searchId}
            type="search"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search by first or last name"
            autoComplete="off"
            className="min-h-12 w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
      {failed && summary && (
        <p className="mt-2 text-sm text-muted-foreground">
          Live updates interrupted. Showing last loaded progress; retrying automatically.
        </p>
      )}
      <div className="mt-4" aria-busy={status === "loading"}>
        {status === "loading" ? (
          <div role="status" aria-label="Loading student progress" className="flex justify-center py-12">
            <LoadingIcon className="size-16" />
          </div>
        ) : summary ? (
          <StudentProgressRoster key={summary.assignmentId} summary={summary} searchQuery={searchQuery} lazyHistory />
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Student progress could not be loaded. Retrying automatically.
          </p>
        )}
      </div>
    </>
  );
}
