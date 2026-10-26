"use client";

import { useActionState, useId } from "react";
import { approveStudent, type ApprovalState } from "@/app/admin/classes/roster-actions";
import type { StudentRoster as Roster, RosterStudent } from "@/lib/server/student-roster";

const INITIAL_STATE: ApprovalState = { status: "idle", message: "" };

type Props = { classId: string; roster: Roster };

export default function StudentRoster({ classId, roster }: Props) {
  const headingId = useId();
  const [state, action, pending] = useActionState(async (previous: ApprovalState, data: FormData): Promise<ApprovalState> => {
    try {
      return await approveStudent(previous, data);
    } catch {
      return { status: "error", message: "Approval could not be confirmed. Refresh the roster and try again." };
    }
  }, INITIAL_STATE);

  function list(title: "Pending" | "Active", students: RosterStudent[]) {
    return (
      <section aria-label={`${title} students`} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="font-semibold">{title} ({students.length})</h4>
          {title === "Pending" && students.length > 1 && (
            <button type="submit" name="intent" value="approve_all" disabled={pending}
              className="rounded-md border border-border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
              Approve all {students.length} pending students
            </button>
          )}
        </div>
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No {title.toLowerCase()} students.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{title} students</caption>
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">First name</th>
                  <th scope="col" className="px-3 py-2">Last name</th>
                  <th scope="col" className="px-3 py-2">Student ID</th>
                  {title === "Pending" && <th scope="col" className="px-3 py-2">Approval</th>}
                </tr>
              </thead>
              <tbody>
                {students.map(student => (
                  <tr key={student.id} className="border-t border-border">
                    <td className="px-3 py-2">{student.first_name}</td>
                    <td className="px-3 py-2">{student.last_name}</td>
                    <td className="px-3 py-2">{student.student_id}</td>
                    {title === "Pending" && (
                      <td className="px-3 py-2">
                        <button type="submit" name="student_id" value={student.id} disabled={pending}
                          aria-label={`Approve ${student.first_name} ${student.last_name}, Student ID ${student.student_id}`}
                          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                          Approve
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId} className="mt-7 space-y-4">
      <h3 id={headingId} className="text-lg font-semibold">Students & approvals</h3>
      <p className="text-sm text-muted-foreground">Pending students cannot sign in until you approve them.</p>
      <p role={state.status === "error" && !pending ? "alert" : "status"}
        className={`text-sm ${state.status === "error" && !pending ? "text-destructive" : "text-foreground"}`}>
        {pending ? "Saving approval…" : state.message}
      </p>
      <form action={action} aria-label="Approve pending students" aria-busy={pending} className="space-y-5">
        <input type="hidden" name="class_id" value={classId} />
        {/* "Approve all" approves exactly these rows, not students who joined after the roster loaded. */}
        {roster.pending.map(student => <input key={student.id} type="hidden" name="pending_id" value={student.id} />)}
        {list("Pending", roster.pending)}
        {list("Active", roster.active)}
      </form>
    </section>
  );
}
