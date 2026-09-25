import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStudentAssignments } from "@/lib/db/student-assignments";
import AssignmentAccess from "@/components/assignments/AssignmentAccess";
import GraduatedCylinder from "@/components/measurement/GraduatedCylinder";
import PrecisionRuler from "@/components/measurement/PrecisionRuler";
import LewisDotExplorer from "@/components/lewis/LewisDotExplorer";
import IonicCompoundExplorer from "@/components/lewis/IonicCompoundExplorer";
import CovalentBondExplorer from "@/components/lewis/CovalentBondExplorer";
import { hasActivityContent } from "@/lib/assignments/activity-content";

export const dynamic = "force-dynamic";

export default async function AssignmentPage({ params }: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  // Same authorized reader as the list; no client-supplied class/student IDs.
  const result = await getStudentAssignments();
  if (result.status === "unauthenticated") redirect("/login/student");
  if (result.status === "error") throw new Error(result.message);
  const assignment = result.assignments.find((item) => item.id === assignmentId);
  if (!assignment) notFound();

  const type = assignment.activity.type;
  return (
    <main className="min-h-screen-below-nav bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/student" className="text-accent underline">Back to assignments</Link>
        <h1 className="text-3xl font-semibold">{assignment.activity.title}</h1>
        <AssignmentAccess key={`${assignment.id}:${assignment.closes_at}`} closesAt={assignment.closes_at}>
          <section className="rounded-xl border border-border bg-card p-6">
            {type === "lewis_diagram" && <LewisDotExplorer />}
            {type === "lewis_structures_ionic" && <IonicCompoundExplorer />}
            {type === "lewis_structures_covalent" && <CovalentBondExplorer />}
            {type === "measurement_graduated_cylinder" && <GraduatedCylinder />}
            {(type === "measurement_ruler_tenths" || type === "measurement_ruler_hundredths") && <PrecisionRuler />}
            {!hasActivityContent(type) && (
              <p className="text-muted-foreground">This activity’s exercise is not available yet.</p>
            )}
          </section>
        </AssignmentAccess>
      </div>
    </main>
  );
}
