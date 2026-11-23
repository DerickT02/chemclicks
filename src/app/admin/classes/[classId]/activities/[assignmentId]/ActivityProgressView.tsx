"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ALL_LESSONS, LessonSelector } from "@/app/admin/classes/[classId]/activities/[assignmentId]/LessonSelector";
import { LiveStudentProgress } from "@/app/admin/classes/[classId]/activities/[assignmentId]/LiveStudentProgress";
import type { TeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";

type Props = {
  initialSummary: TeacherActivityAttemptSummary;
  assignments: readonly { id: string; title: string }[];
};

export function ActivityProgressView({ initialSummary, assignments }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const lessonHref = (id: string) => `/admin/classes/${encodeURIComponent(initialSummary.classId)}/activities/${encodeURIComponent(id)}`;
  const assignment = assignments.find(item => lessonHref(item.id) === pathname);
  const assignmentId = assignment?.id ?? initialSummary.assignmentId;
  const title = assignment?.title ?? initialSummary.activityTitle;

  useEffect(() => {
    document.title = `${title} · Student progress | ChemClicks`;
  }, [title]);

  const selectLesson = (id: string) => {
    if (id === ALL_LESSONS) {
      router.push(`/admin?classId=${encodeURIComponent(initialSummary.classId)}#class-activities`);
    } else if (id !== assignmentId && assignments.some(item => item.id === id)) {
      window.history.pushState(null, "", lessonHref(id));
    }
  };

  return (
    <>
      <p className="mb-2 text-muted-foreground">{initialSummary.className}</p>
      <LessonSelector assignmentId={assignmentId} assignments={assignments} onChange={selectLesson} />
      <LiveStudentProgress assignmentId={assignmentId} initialSummary={initialSummary} />
    </>
  );
}
