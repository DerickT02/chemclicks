import Link from "next/link";
import { assignmentPath } from "@/lib/assignments/sequence";
import type { StudentAssignment } from "@/lib/db/student-assignments";

type Props = {
  /** The earlier section the student still has to finish. */
  blocker: Pick<StudentAssignment, "id" | "activity">;
};

/** Shown in place of a section or quiz whose earlier sections are unfinished. */
export default function LockedSection({ blocker }: Props) {
  return (
    <section role="status" className="space-y-3 rounded-xl border border-dashed border-border bg-card p-5">
      <p className="font-semibold">This section is locked.</p>
      <p className="text-sm text-muted-foreground">
        Finish {blocker.activity.title} first. Sections open in order as you complete them.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href={assignmentPath(blocker)} prefetch={false}
          className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
          Go to {blocker.activity.title}
        </Link>
        <Link href="/student" className="inline-flex rounded-md border border-border px-4 py-2 text-sm font-semibold">
          Back to assignments
        </Link>
      </div>
    </section>
  );
}
