"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLiveTeacherProgress } from "@/components/assignments/useLiveTeacherProgress";
import { classSnapshotCursor, mergeClassSnapshot, type TeacherClassSnapshot } from "@/lib/teacher-class-snapshot";
import type { StudentRoster } from "@/lib/server/student-roster";
import type { TeacherClassLessonProgress } from "@/lib/server/teacher-lesson-progress";

type LiveClassroom = { data: TeacherClassSnapshot | null; failed: boolean };
const Context = createContext<LiveClassroom | null>(null);

type Props = {
  classId: string;
  initialRoster: StudentRoster | null;
  initialProgress: TeacherClassLessonProgress | null;
  children: ReactNode;
};

export function LiveClassroomProvider({ classId, initialRoster, initialProgress, children }: Props) {
  const initial = useMemo<TeacherClassSnapshot | null>(() => !initialRoster || !initialProgress ? null : {
    classId, revision: null, reset: true, removedStudentIds: [],
    roster: initialRoster, progress: initialProgress, attempts: null,
  }, [classId, initialRoster, initialProgress]);
  const value = useLiveTeacherProgress(`/admin/classes/${encodeURIComponent(classId)}/updates`, initial, {
    classId, getCursor: classSnapshotCursor, merge: mergeClassSnapshot,
  });
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLiveClassroom(): LiveClassroom | null {
  return useContext(Context);
}
