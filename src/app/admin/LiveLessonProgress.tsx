"use client";

import { LessonProgressList } from "@/app/admin/LessonProgressList";
import { useLiveTeacherProgress } from "@/components/assignments/useLiveTeacherProgress";
import type { TeacherClassLessonProgress } from "@/lib/server/teacher-lesson-progress";

type Props = {
  classId: string;
  initialProgress: TeacherClassLessonProgress | null;
};

export function LiveLessonProgress({ classId, initialProgress }: Props) {
  const { data, failed } = useLiveTeacherProgress(
    `/admin/classes/${encodeURIComponent(classId)}/progress`,
    initialProgress,
  );

  return (
    <>
      <p role="status" className="mb-3 text-sm text-muted-foreground">
        {failed
          ? data ? "Live updates interrupted. Showing last loaded progress; retrying automatically." : "Student progress could not be loaded. Retrying automatically."
          : "Progress updates automatically every 5 seconds while this tab is visible."}
      </p>
      {data && (
        <div className="max-h-[480px] overflow-y-auto rounded-lg border border-border p-4">
          <LessonProgressList students={data.students} />
        </div>
      )}
    </>
  );
}
