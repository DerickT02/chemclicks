"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLiveTeacherProgress } from "@/components/assignments/useLiveTeacherProgress";
import { classSnapshotCursor, mergeClassSnapshot, type TeacherClassSnapshot } from "@/lib/teacher-class-snapshot";
import type { StudentRoster } from "@/lib/server/student-roster";
import type { TeacherClassLessonProgress } from "@/lib/server/teacher-lesson-progress";

type LiveClassroom = {
  /** Latest roster: live data, else the server-rendered roster, else null. */
  roster: StudentRoster | null;
  /** Latest class progress: live data, else the server-rendered progress, else null. */
  progress: TeacherClassLessonProgress | null;
  failed: boolean;
};
const Context = createContext<LiveClassroom | null>(null);

type Props = {
  classId: string;
  initialRoster: StudentRoster | null;
  initialProgress: TeacherClassLessonProgress | null;
  children: ReactNode;
};

/** One combined, revision-based live read shared by every view of a class. */
export function LiveClassroomProvider({ classId, initialRoster, initialProgress, children }: Props) {
  // A missing server-rendered resource leaves no seed, so the first read runs
  // immediately and returns both resources from one database snapshot.
  const initial = useMemo<TeacherClassSnapshot | null>(() => !initialRoster || !initialProgress ? null : {
    classId, revision: null, reset: true, removedStudentIds: [],
    roster: initialRoster, progress: initialProgress, attempts: null,
  }, [classId, initialRoster, initialProgress]);
  const { data, failed } = useLiveTeacherProgress(`/admin/classes/${encodeURIComponent(classId)}/updates`, initial, {
    classId, getCursor: classSnapshotCursor, merge: mergeClassSnapshot,
  });
  const roster = data?.roster ?? initialRoster;
  const progress = data?.progress ?? initialProgress;
  const value = useMemo(() => ({ roster, progress, failed }), [roster, progress, failed]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLiveClassroom(): LiveClassroom | null {
  return useContext(Context);
}
