import LocalizedTimestamp from "@/components/datetime/LocalizedTimestamp";
import type { ExplorationAttempt } from "@/lib/server/student-assignments";

type Props = { attempts: ExplorationAttempt[] };

export default function AttemptHistory({ attempts }: Props) {
  return (
    <details className="rounded-xl border border-border bg-card p-5">
      <summary className="cursor-pointer font-medium">Saved exploration history ({attempts.length})</summary>
      {attempts.length === 0 ? <p className="mt-3 text-sm">No exploration attempts have been saved yet.</p> : (
        <ul className="mt-3 space-y-2 text-sm">
          {attempts.map(attempt => <li key={attempt.id}>
            Attempt {attempt.attempt_number}: {attempt.status === "completed" ? "Completed" : "In progress"} — started <LocalizedTimestamp value={attempt.started_at} />
            {attempt.completed_at && <>; completed <LocalizedTimestamp value={attempt.completed_at} /></>}
          </li>)}
        </ul>
      )}
    </details>
  );
}
