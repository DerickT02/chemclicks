import Link from "next/link";
import { findLewisQuizAssignment } from "@/lib/assignments/lewis-quiz-access";
import { LEWIS_QUIZZES, type LewisQuizKind } from "@/lib/assignments/lewis-quizzes";
import type { StudentAssignment } from "@/lib/db/student-assignments";

type Props = {
  kind: LewisQuizKind;
  /** The signed-in student's server-verified class assignments. */
  assignments: StudentAssignment[];
};

export default function LewisQuizCard({ kind, assignments }: Props) {
  const { title, path, lessonTitle } = LEWIS_QUIZZES[kind];
  const unlocked = findLewisQuizAssignment(assignments, kind) !== null;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {unlocked ? (
        <Link href={path} prefetch={false}
          className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
          Start quiz
        </Link>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          Locked. Your teacher must assign the {lessonTitle} lesson to your class before you can take this quiz.
        </p>
      )}
    </section>
  );
}
