import LocalizedTimestamp from "@/components/datetime/LocalizedTimestamp";
import type { StudentAttempt } from "@/lib/db/student_attempts";

type Props = {
  title: string;
  attempts: StudentAttempt[];
};

export default function QuizAttemptHistory({ title, attempts }: Props) {
  return (
    <section aria-label={`${title} history`} className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">{title} history</h2>
      {attempts.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No quiz attempts yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {attempts.map((attempt) => (
            <li key={attempt.id} className="rounded-lg border border-border bg-muted p-3 text-sm">
              <p className="font-medium">Attempt {attempt.attempt_number}</p>
              {attempt.status === "completed" ? (
                <p className="mt-1">
                  {`${attempt.score ?? 0} of ${attempt.question_total ?? 0} correct · ${attempt.passed ? "Passed" : "Not passed"}`}
                  {attempt.completed_at && (
                    <> · completed <LocalizedTimestamp value={attempt.completed_at} /></>
                  )}
                </p>
              ) : (
                <p className="mt-1">In progress</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
