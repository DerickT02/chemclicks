import Link from "next/link";
import { deleteOwnedClass } from "@/lib/server/classes";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AssignmentForm from "@/app/admin/assignments/AssignmentForm";
import AssignmentScheduleForm from "@/app/admin/assignments/AssignmentScheduleForm";
import UnassignActivityForm from "@/app/admin/assignments/UnassignActivityForm";
import { listActivityCatalog } from "@/lib/db/activities";
import { getClassActivities } from "@/lib/db/class_activities";
import { listActiveClassesForTeacher } from "@/lib/db/classes";
import { getTeacherClassLessonProgress } from "@/lib/server/teacher-lesson-progress";
import { createServiceClient } from "@/lib/server/database";
import { LessonProgressList } from "@/app/admin/LessonProgressList";

type StudentSummary = {
  id: string;
  class_id: string;
};

type ClassWithStudents = {
  id: string;
  name: string;
  section: string;
  class_code: string;
  students: StudentSummary[] | null;
};

function formatAssignmentTimestamp(value: string): string {
  return `${new Date(value).toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const supabase = await createClient();
  const [{ classId }, { data: userData }] = await Promise.all([
    searchParams,
    supabase.auth.getUser(),
  ]);

  if (!userData.user) {
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

  if (classesError) {
    throw new Error("We couldn't load your classes. Please try again.");
  }

  const baseClasses: ClassWithStudents[] = ((classesData ?? []) as Omit<ClassWithStudents, "students">[])
    .map((classItem) => ({ ...classItem, students: [] }));

  // classIds are already scoped to this teacher by listActiveClassesForTeacher
  // above, so reading student counts via the service-role client here is safe
  // (no separate ownership check needed) and avoids depending on an RLS
  // policy granting teachers direct SELECT on students.
  const classIds = baseClasses.map((classItem) => classItem.id);
  const { data: studentsData } =
    classIds.length === 0
      ? { data: [] as StudentSummary[] }
      : await createServiceClient()
          .from("students")
          .select("id, class_id")
          .in("class_id", classIds);

  const studentsByClass = new Map<string, StudentSummary[]>();
  for (const student of (studentsData ?? []) as StudentSummary[]) {
    const existing = studentsByClass.get(student.class_id) ?? [];
    existing.push(student);
    studentsByClass.set(student.class_id, existing);
  }

  const classes: ClassWithStudents[] = baseClasses.map((classItem) => ({
    ...classItem,
    students: studentsByClass.get(classItem.id) ?? [],
  }));
  const selectedClass =
    classes.find((item) => item.id === classId) ??
    (classes.length > 0 ? classes[0] : undefined);

  const [catalogResult, assignmentsResult, lessonProgressResult] = await Promise.all([
    listActivityCatalog(supabase),
    selectedClass
      ? getClassActivities(supabase, selectedClass.id)
      : Promise.resolve({ data: [], error: null }),
    selectedClass
      ? getTeacherClassLessonProgress(selectedClass.id).then(
          (data) => ({ data, error: null as string | null }),
          (error: unknown) => ({
            data: null,
            error: error instanceof Error ? error.message : "Unknown error",
          }),
        )
      : Promise.resolve({ data: null, error: null as string | null }),
  ]);

  const activities = catalogResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const assignedActivityIds = assignments.map(
    (assignment) => assignment.activity_id,
  );
  const catalogLoadFailed = Boolean(catalogResult.error);
  const assignmentsLoadFailed = Boolean(assignmentsResult.error);
  const lessonProgressLoadFailed = Boolean(lessonProgressResult.error);
  const lessonProgressStudents = lessonProgressResult.data?.students ?? [];

  async function removeSelectedClass(formData: FormData) {
    "use server";
    const id = formData.get("classId") as string;
    if (!id) return;
    await deleteOwnedClass(id);
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground md:px-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Classrooms</h1>
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
                  <p>No classes yet.</p>
                  <Link
                    href="/admin/create-class"
                    className="mt-2 inline-flex text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Create your first class
                  </Link>
                </div>
              ) : (
                classes.map((classItem) => {
                  const isSelected = selectedClass?.id === classItem.id;
                  const studentCount = classItem.students?.length ?? 0;
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
                  <form action={removeSelectedClass}>
                    <input type="hidden" name="classId" value={selectedClass.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Remove class
                    </button>
                  </form>
                </div>
                {selectedClass.section ? (
                  <p className="mt-2 text-sm text-muted-foreground">{selectedClass.section}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {(selectedClass.students?.length ?? 0).toString()} students enrolled
                </p>
                <section className="mt-7 space-y-6">
                  <h3 className="text-lg font-semibold">Class activities</h3>

                  {catalogLoadFailed ? (
                    <p role="alert" className="text-sm text-destructive">
                      The activity catalog could not be loaded. Please refresh the page.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-4 rounded-lg border border-border p-4">
                        <h4 className="font-medium">Assign an activity</h4>
                        <AssignmentForm
                          key={selectedClass.id}
                          classId={selectedClass.id}
                          activities={activities}
                          assignedActivityIds={assignedActivityIds}
                        />
                      </div>

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

                          return (
                            <div
                              key={assignment.id}
                              className="rounded-lg border border-border p-4"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <h4 className="font-medium">
                                    {activity?.title ?? "Assigned activity"}
                                  </h4>
                                  {activity ? (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {activity.description}
                                    </p>
                                  ) : null}
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    Assigned{" "}
                                    {formatAssignmentTimestamp(
                                      assignment.created_at,
                                    )}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                    Assigned
                                  </span>
                                  <UnassignActivityForm
                                    classId={selectedClass.id}
                                    assignmentId={assignment.id}
                                    activityTitle={
                                      activity?.title ?? "Assigned activity"
                                    }
                                  />
                                </div>
                              </div>
                              <AssignmentScheduleForm
                                key={`${assignment.id}:${assignment.opens_at ?? ""}:${assignment.closes_at ?? ""}`}
                                classId={selectedClass.id}
                                assignmentId={assignment.id}
                                activityId={assignment.activity_id}
                                initialOpensAt={assignment.opens_at}
                                initialClosesAt={assignment.closes_at}
                              />
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </section>
                <Link href={`/admin/classes/${selectedClass.id}/attempts`} className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  Activity attempts
                </Link>
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
