import Link from "next/link";
import DisableClassControl from "@/app/admin/classes/DisableClassControl";
import { createClient } from "@/lib/supabase/server";
import AssignmentForm from "@/app/admin/assignments/AssignmentForm";
import AssignmentSchedule from "@/app/admin/assignments/AssignmentSchedule";
import { listActivityCatalog } from "@/lib/db/activities";
import { getClassActivities } from "@/lib/db/class_activities";
import { getNewAssignmentBlockReason } from "@/lib/activities/registry";
import { listActiveClassesForTeacher, type ClassListItem } from "@/lib/db/classes";
import { getTeacherRoster, getClassCurrentProgress, type TeacherRosterStudent, type TeacherProgressRow } from "@/lib/db/teacher-dashboard";
import { summarizeCurrentExplorations } from "@/lib/assignments/exploration-progress";


type ClassWithStudents = ClassListItem & { students: TeacherRosterStudent[] };

function formatAssignmentTimestamp(value: string): string {
  return `${new Date(value).toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; classDisabled?: string }>;
}) {
  const supabase = await createClient();
  const [{ classId, classDisabled }, { data: userData, error: authError }] = await Promise.all([
    searchParams,
    supabase.auth.getUser(),
  ]);

  if (authError || !userData.user) {
    return (
      <div className="min-h-screen bg-background px-6 py-12 text-foreground md:px-10">
        <h1 className="text-3xl font-semibold">Classrooms</h1>
        <p className="mt-3 text-muted-foreground">Please sign in to view your classes.</p>
      </div>
    );
  }

  const { data: classesData, error: classesError } = await listActiveClassesForTeacher(
    supabase,
    userData.user.id,
  );

  if (classesError || classesData === null) {
    throw new Error("We couldn't load your classes. Please try again.");
  }

  const baseClasses = classesData ?? [];
  const rosterResult = await getTeacherRoster(supabase, baseClasses.map(classItem => classItem.id));
  const rosterLoadFailed = Boolean(rosterResult.error) || rosterResult.data === null;
  const studentsByClass = new Map<string, TeacherRosterStudent[]>();
  for (const student of rosterResult.data ?? []) {
    const existing = studentsByClass.get(student.class_id) ?? [];
    existing.push(student);
    studentsByClass.set(student.class_id, existing);
  }
  const classes: ClassWithStudents[] = baseClasses.map(classItem => ({
    ...classItem, students: studentsByClass.get(classItem.id) ?? [],
  }));
  const selectedClass =
    classes.find((item) => item.id === classId) ??
    (classes.length > 0 ? classes[0] : undefined);

  const [catalogResult, assignmentsResult] = await Promise.all([
    listActivityCatalog(supabase),
    selectedClass
      ? getClassActivities(supabase, selectedClass.id)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const activities = catalogResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const assignedActivityIds = assignments.map(
    (assignment) => assignment.activity_id,
  );
  const catalogLoadFailed = Boolean(catalogResult.error) || catalogResult.data === null;
  const assignmentsLoadFailed = Boolean(assignmentsResult.error) || assignmentsResult.data === null;
  const progressResult = selectedClass && !rosterLoadFailed && !assignmentsLoadFailed
    && selectedClass.students.length > 0 && assignments.length > 0
    ? await getClassCurrentProgress(supabase, selectedClass.id)
    : { data: [], error: null };
  const progressLoadFailed = assignmentsLoadFailed || Boolean(progressResult.error) || progressResult.data === null;
  const progressByStudent = new Map<string, TeacherProgressRow[]>();
  for (const row of progressResult.data ?? []) {
    const rows = progressByStudent.get(row.student_id) ?? [];
    rows.push(row);
    progressByStudent.set(row.student_id, rows);
  }
  const assignmentIds = assignments.map(assignment => assignment.id);
  // Request-time Server Component snapshot; client clocks subscribe after hydration.
  // eslint-disable-next-line react-hooks/purity -- This server-only clock read is not a client render-time side effect.
  const scheduleRenderedAt = Date.now();


  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground md:px-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Classrooms</h1>
        {classDisabled === "1" && (
          <p role="status" className="mt-3 text-sm text-foreground">
            Class disabled. Student access is blocked; classroom data has been kept.
          </p>
        )}
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Teacher admin view. Create classes, share classroom codes, and see where students
          are in the lesson.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Your classes</h2>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {classes.length}
              </span>
            </div>

            <div className="space-y-2">
              {classes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  <p>No active classes.</p>
                  <Link
                    href="/admin/create-class"
                    className="mt-2 inline-flex text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Create a class
                  </Link>
                </div>
              ) : (
                classes.map((classItem) => {
                  const isSelected = selectedClass?.id === classItem.id;
                  const studentCount = classItem.students.length;
                  return (
                    <Link
                      key={classItem.id}
                      href={`/admin?classId=${classItem.id}`}
                      aria-current={isSelected ? "true" : undefined}
                      className={`block rounded-lg border px-3 py-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isSelected
                          ? "border-accent bg-muted"
                          : "border-border bg-background/40 hover:border-ring"
                      }`}
                    >
                      <p className="truncate text-sm font-medium text-foreground">{classItem.name}</p>
                      {classItem.section ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{classItem.section}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {rosterLoadFailed ? "Enrollment unavailable" : `${studentCount} ${studentCount === 1 ? "student" : "students"}`} · Code{" "}
                        {classItem.class_code}
                      </p>
                    </Link>
                  );
                })
              )}
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground">Add a class</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Set up a new class and share its join code with students.
              </p>
              <Link
                href="/admin/create-class"
                className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Create class
              </Link>
            </div>
          </aside>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            {!selectedClass ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border">
                <p className="text-sm text-muted-foreground">
                  Select a class from the left panel to view details.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold text-foreground">{selectedClass.name}</h2>
                    <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground">
                      {selectedClass.class_code}
                    </span>
                  </div>
                  <DisableClassControl key={selectedClass.id} classId={selectedClass.id} className={selectedClass.name} />
                </div>
                {selectedClass.section ? (
                  <p className="mt-2 text-sm text-muted-foreground">{selectedClass.section}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {rosterLoadFailed ? "Enrollment count unavailable" : `${selectedClass.students.length} ${selectedClass.students.length === 1 ? "student" : "students"} enrolled`}
                </p>
                <section className="mt-7 space-y-6">
                  <h3 className="text-lg font-semibold">Class activities</h3>

                  {catalogLoadFailed && (
                    <p role="alert" className="text-sm text-destructive">
                      The activity catalog could not be loaded. Please refresh the page.
                    </p>
                  )}
                      {!catalogLoadFailed && !assignmentsLoadFailed && (
                        <div className="space-y-4 rounded-lg border border-border p-4">
                          <h4 className="font-medium">Assign an activity</h4>
                          <AssignmentForm
                            key={selectedClass.id}
                            classId={selectedClass.id}
                            className={selectedClass.name}
                            activities={activities}
                            assignedActivityIds={assignedActivityIds}
                          />
                        </div>
                      )}

                      {assignmentsLoadFailed ? (
                        <p role="alert" className="text-sm text-destructive">
                          Assigned activities could not be loaded. Please refresh the page.
                        </p>
                      ) : assignments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          This class has no assigned activities.
                        </p>
                      ) : (
                        assignments.map((assignment) => {
                          const activity = activities.find(
                            (item) => item.id === assignment.activity_id,
                          );
                          const blockReason = activity
                            ? getNewAssignmentBlockReason(activity.type)
                            : "This activity is unavailable in the current catalog.";

                          return (
                            <div
                              key={assignment.id}
                              className="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
                            >
                              <div className="min-w-0 flex-1">
                                <h4 className="font-medium">
                                  {activity?.title ?? "Assigned activity"}
                                </h4>
                                {activity ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {activity.description}
                                  </p>
                                ) : null}
                                {blockReason ? (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    New assignments unavailable: {blockReason}
                                  </p>
                                ) : null}
                                <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                                  <div className="flex flex-wrap gap-x-2">
                                    <dt className="font-medium text-foreground/80">
                                      Assigned
                                    </dt>
                                    <dd>
                                      {formatAssignmentTimestamp(assignment.created_at)}
                                    </dd>
                                  </div>
                                </dl>
                                <AssignmentSchedule
                                  classId={selectedClass.id}
                                  className={selectedClass.name}
                                  activityTitle={activity?.title ?? "Assigned activity"}
                                  assignment={assignment}
                                  renderedAt={scheduleRenderedAt}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                </section>
                <Link href={`/admin/classes/${selectedClass.id}/attempts`} className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  Activity attempts
                </Link>
                <div className="mt-7">
                  <h3 className="text-lg font-semibold text-foreground">Enrolled students</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Current exploration status, not quiz grades or ever-completed history. Retrying can move
                    completed work back to in progress; earlier saved attempts remain in Activity attempts.
                  </p>
                  {!rosterLoadFailed && progressLoadFailed && (
                    <p role="alert" className="mt-3 text-sm text-destructive">
                      Exploration progress could not be loaded. Please refresh the page.
                    </p>
                  )}
                  <div className="mt-4 space-y-4">
                    {rosterLoadFailed ? (
                      <p role="alert" className="text-sm text-destructive">
                        Enrollment data could not be loaded. Please refresh the page.
                      </p>
                    ) : selectedClass.students.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                        No students in this class yet.
                      </p>
                    ) : (
                      selectedClass.students.map((student) => {
                        const summary = progressLoadFailed ? null : summarizeCurrentExplorations(
                          assignmentIds, progressByStudent.get(student.id) ?? [],
                        );

                        return (
                          <div key={student.id} className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {student.first_name} {student.last_name}
                                </p>
                                {summary === null ? (
                                  <p role="alert" className="text-xs text-destructive">Progress unavailable.</p>
                                ) : summary.assigned === 0 ? (
                                  <p className="text-xs text-muted-foreground">No activities assigned.</p>
                                ) : (
                                  <>
                                    <p className="text-xs text-muted-foreground">
                                      {summary.completed} of {summary.assigned} assigned activities currently completed
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {summary.inProgress} in progress · {summary.notStarted} not started
                                    </p>
                                  </>
                                )}
                              </div>
                              {summary && summary.percent !== null && (
                                <p className="text-xs text-muted-foreground">{summary.percent}%</p>
                              )}
                            </div>

                            {summary && summary.percent !== null && (
                              <div role="progressbar" aria-label={`${student.first_name} ${student.last_name}: current exploration completion`}
                                aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.percent}
                                aria-valuetext={`${summary.completed} of ${summary.assigned} assigned activities currently completed`}
                                className="h-2 rounded-full bg-muted">
                                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${summary.percent}%` }} />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
