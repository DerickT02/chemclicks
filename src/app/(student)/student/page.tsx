import Link from "next/link";
import { hasActivityContent } from "@/lib/assignments/activity-content";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStudentAssignments } from "@/lib/db/student-assignments";

export const metadata: Metadata = { title: "My Assignments | ChemClicks" };
export const dynamic = "force-dynamic";

export default async function StudentAssignmentsPage() {
  const result = await getStudentAssignments();
  if (result.status === "unauthenticated") redirect("/login/student");

  return (
    <main className="min-h-screen-below-nav bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">My assignments</h1>
          <p className="text-sm text-muted-foreground">Activities currently available for your class.</p>
        </header>
        {result.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">{result.message}</p>
        ) : result.assignments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-muted-foreground">
            No activities are available right now.
          </p>
        ) : (
          <ul className="space-y-4">
            {result.assignments.map((assignment) => (
              <li key={assignment.id} className="space-y-3 rounded-xl border border-border bg-card p-5">
                <h2 className="text-lg font-semibold">{assignment.activity.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {assignment.closes_at
                    ? `Closes ${new Date(assignment.closes_at).toISOString().replace("T", " ").slice(0, 19)} UTC`
                    : "No closing deadline"}
                </p>
                {hasActivityContent(assignment.activity.type) ? (
                  <Link href={`/student/assignments/${assignment.id}`} prefetch={false}
                    className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
                    Open activity
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">Exercise not available yet.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
