import Link from "next/link";
import DisableClassControl from "@/app/admin/classes/DisableClassControl";
import CopyClassCode from "@/app/admin/classes/CopyClassCode";
import RefreshAssignments from "@/components/assignments/RefreshAssignments";
import { createClient } from "@/lib/supabase/server";
import AssignmentForm from "@/app/admin/assignments/AssignmentForm";
import AssignmentSchedule from "@/app/admin/assignments/AssignmentSchedule";
import UnassignActivityForm from "@/app/admin/assignments/UnassignActivityForm";
import LocalizedTimestamp from "@/components/datetime/LocalizedTimestamp";
import { listActivityCatalog } from "@/lib/db/activities";
import { getClassActivities } from "@/lib/db/class_activities";
import { getNewAssignmentBlockReason } from "@/lib/activities/registry";
import { listActiveClassesForTeacher } from "@/lib/db/classes";
import { createServiceClient } from "@/lib/server/database";
import { requireTeacherId } from "@/lib/server/teacher";
import { getTeacherClassLessonProgress } from "@/lib/server/teacher-lesson-progress";
import { LessonProgressList } from "@/app/admin/LessonProgressList";
import StudentRoster from "@/app/admin/classes/StudentRoster";
import { getOwnedStudentRoster } from "@/lib/server/student-roster";


export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; classDisabled?: string; classCreated?: string }>;
}) {
  const supabase = await createClient();
  // One verification for the whole request; the lesson progress reader reuses it.
  const [{ classId, classDisabled, classCreated }, teacherId] = await Promise.all([
    searchParams,
    requireTeacherId().catch(() => null),
  ]);

  if (!teacherId) {
    return (
      <div className="min-h-screen bg-background px-6 py-12 text-foreground md:px-10">
        <h1 className="text-3xl font-semibold">Classrooms</h1>
        <p className="mt-3 text-muted-foreground">Please sign in to view your classes.</p>
      </div>
    );
  }

  const loadClassDetails = (id: string) => Promise.all([
    getClassActivities(supabase, id),
    getOwnedStudentRoster(id).then(
      (data) => ({ data, error: false }),
      () => ({ data: null, error: true }),
    ),
    getTeacherClassLessonProgress(id).then(
      (data) => ({ data, error: null as string | null }),
      (error: unknown) => ({
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    ),
  ]);

  // The class list, the catalog and the class named in the URL do not depend on
  // each other, so they load together. Both class readers enforce ownership
  // themselves, and their results are used only if that class turns out to be
  // in this teacher's own list.
  const [{ data: classesData, error: classesError }, catalogResult, requestedDetails] = await Promise.all([
    // The service role is needed for the student counts: the teacher's own
    // session cannot read the students table. The query is limited to the
    // verified teacher's classes, so nothing else is exposed.
    listActiveClassesForTeacher(createServiceClient(), teacherId),
    listActivityCatalog(supabase),
    classId ? loadClassDetails(classId) : null,
  ]);

  if (classesError || classesData === null) {
    throw new Error("We couldn't load your classes. Please try again.");
  }

  const classes = classesData;
  const selectedClass =
    classes.find((item) => item.id === classId) ??
    (classes.length > 0 ? classes[0] : undefined);

  const [assignmentsResult, rosterResult, lessonProgressResult] = !selectedClass
    ? [{ data: [], error: null }, { data: null, error: false }, { data: null, error: null as string | null }]
    : requestedDetails && selectedClass.id === classId
      ? requestedDetails
      // No class in the URL, or not one of the teacher's: load the fallback class.
      : await loadClassDetails(selectedClass.id);

  const activities = catalogResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const assignedActivityIds = assignments.map(
    (assignment) => assignment.activity_id,
  );
  const catalogLoadFailed = Boolean(catalogResult.error) || catalogResult.data === null;
  const assignmentsLoadFailed = Boolean(assignmentsResult.error) || assignmentsResult.data === null;
  const lessonProgressLoadFailed = Boolean(lessonProgressResult.error);
  const lessonProgressStudents = lessonProgressResult.data?.students ?? [];
  // Request-time status snapshot; dashboard refreshes update it.
  // eslint-disable-next-line react-hooks/purity -- This server-only clock read is not a client render-time side effect.
  const scheduleRenderedAt = Date.now();


  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground md:px-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Classrooms</h1>
        {classCreated === "1" && selectedClass?.id === classId && (
          <p role="status" className="mt-3 text-sm text-foreground">Class created. Share its classroom code below.</p>
        )}
        {classDisabled === "1" && (
          <p role="status" className="mt-3 text-sm text-foreground">
            Class disabled. Student access is blocked; classroom data has been kept.
          </p>
        )}

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
                  const studentCount = classItem.student_count;
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
                        {studentCount} {studentCount === 1 ? "student" : "students"} · Code{" "}
                        {classItem.class_code}
                      </p>
                    </Link>
                  );
                })
              )}
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground">Add a class</h3>
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
                  {selectedClass.student_count} {selectedClass.student_count === 1 ? "student" : "students"} enrolled
                </p>
                <div className="mt-4"><CopyClassCode key={selectedClass.id} code={selectedClass.class_code} /></div>
                {rosterResult.error || !rosterResult.data ? (
                  <section aria-label="Students & approvals" className="mt-7 space-y-3">
                    <h3 className="text-lg font-semibold">Students & approvals</h3>
                    <p role="alert" className="text-sm text-destructive">Student roster could not be loaded. Please try again.</p>
                    <RefreshAssignments label="Retry student roster" />
                  </section>
                ) : (
                  <StudentRoster key={selectedClass.id} classId={selectedClass.id} roster={rosterResult.data} />
                )}
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
                              className="rounded-lg border border-border p-4"
                            >
                              <div className="flex items-start justify-between gap-4">
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
                                        <LocalizedTimestamp value={assignment.created_at} />
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
                                <div className="shrink-0">
                                  <UnassignActivityForm
                                    classId={selectedClass.id}
                                    assignmentId={assignment.id}
                                    activityTitle={
                                      activity?.title ?? "Assigned activity"
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                </section>
                <Link href={`/admin/classes/${selectedClass.id}/attempts`} className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  Activity attempts
                </Link>
                <div className="mt-4"><RefreshAssignments label="Refresh classroom" /></div>
                <div className="mt-7">
                  <h3 className="text-lg font-semibold text-foreground">Student progress</h3>
                  <div className="mt-4">
                    {lessonProgressLoadFailed ? (
                      <p role="alert" className="text-sm text-destructive">
                        Student progress could not be loaded. Please refresh the page.
                      </p>
                    ) : (
                      <div className="max-h-[480px] overflow-y-auto rounded-lg border border-border p-4">
                        <LessonProgressList students={lessonProgressStudents} />
                      </div>
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
