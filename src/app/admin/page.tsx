import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type ProgressStatus = "not_started" | "in_progress" | "completed";

type StudentWithProgress = {
  id: string;
  class_id: string;
  first_name: string;
  last_name: string;
  student_progress: Array<{ status: ProgressStatus }> | null;
};

type ClassWithStudents = {
  id: string;
  name: string;
  section: string;
  class_code: string;
  students: StudentWithProgress[] | null;
};

type ClassActivity = {
  id: string;
  class_id: string;
};

type StudentProgressRow = {
  student_id: string;
  class_activity_id: string;
  status: ProgressStatus;
};

function statusText(status: ProgressStatus | null): string {
  if (status === "completed") return "Completed current activity";
  if (status === "in_progress") return "In progress";
  return "Not started";
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

  const { data: classesData } = await supabase
    .from("classes")
    .select("id, name, section, class_code")
    .order("created_at", { ascending: false });

  const baseClasses: ClassWithStudents[] = ((classesData ?? []) as Omit<ClassWithStudents, "students">[])
    .map((classItem) => ({ ...classItem, students: [] }));

  const classIds = baseClasses.map((classItem) => classItem.id);
  const { data: studentsData } =
    classIds.length === 0
      ? { data: [] as StudentWithProgress[] }
      : await supabase
          .from("students")
          .select("id, class_id, first_name, last_name")
          .in("class_id", classIds);

  const studentsByClass = new Map<string, StudentWithProgress[]>();
  for (const student of (studentsData ?? []) as StudentWithProgress[]) {
    const existing = studentsByClass.get(student.class_id) ?? [];
    existing.push({ ...student, student_progress: [] });
    studentsByClass.set(student.class_id, existing);
  }

  const { data: classActivitiesData } =
    classIds.length === 0
      ? { data: [] as ClassActivity[] }
      : await supabase.from("class_activities").select("id, class_id").in("class_id", classIds);

  const classActivityIds = (classActivitiesData ?? []).map((row) => row.id);
  const { data: studentProgressData } =
    classActivityIds.length === 0
      ? { data: [] as StudentProgressRow[] }
      : await supabase
          .from("student_progress")
          .select("student_id, class_activity_id, status")
          .in("class_activity_id", classActivityIds);

  const progressByStudent = new Map<string, Array<{ status: ProgressStatus }>>();
  for (const row of (studentProgressData ?? []) as StudentProgressRow[]) {
    const list = progressByStudent.get(row.student_id) ?? [];
    list.push({ status: row.status });
    progressByStudent.set(row.student_id, list);
  }

  const classes: ClassWithStudents[] = baseClasses.map((classItem) => {
    const studentsForClass = studentsByClass.get(classItem.id) ?? [];
    const hydratedStudents = studentsForClass.map((student) => ({
      ...student,
      student_progress: progressByStudent.get(student.id) ?? [],
    }));

    return { ...classItem, students: hydratedStudents };
  });
  const selectedClass =
    classes.find((item) => item.id === classId) ??
    (classes.length > 0 ? classes[0] : undefined);

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
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  No classes yet. Create your first class below.
                </p>
              ) : (
                classes.map((classItem) => {
                  const isSelected = selectedClass?.id === classItem.id;
                  const studentCount = classItem.students?.length ?? 0;
                  return (
                    <Link
                      key={classItem.id}
                      href={`/admin?classId=${classItem.id}`}
                      className={`block rounded-lg border px-3 py-2.5 transition ${
                        isSelected
                          ? "border-accent bg-muted"
                          : "border-border bg-background/40 hover:border-ring"
                      }`}
                    >
                      <p className="truncate text-sm font-medium text-foreground">{classItem.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {studentCount} students · Code {classItem.class_code}
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
                className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
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
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-foreground">{selectedClass.name}</h2>
                  <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground">
                    {selectedClass.class_code}
                  </span>
                </div>
                {selectedClass.section ? (
                  <p className="mt-2 text-sm text-muted-foreground">{selectedClass.section}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {(selectedClass.students?.length ?? 0).toString()} students enrolled
                </p>
                <div className="mt-7">
                  <h3 className="text-lg font-semibold text-foreground">Active students</h3>
                  {/* Live DB-backed list: once student signup writes records, students appear automatically here. */}
                  <div className="mt-4 space-y-4">
                    {(selectedClass.students ?? []).length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                        No students in this class yet.
                      </p>
                    ) : (
                      (selectedClass.students ?? []).map((student) => {
                        const progressItems = student.student_progress ?? [];
                        const completedCount = progressItems.filter(
                          (progress) => progress.status === "completed",
                        ).length;
                        const progressPercent =
                          progressItems.length === 0
                            ? 0
                            : Math.round((completedCount / progressItems.length) * 100);
                        const lastStatus =
                          progressItems.length > 0
                            ? progressItems[progressItems.length - 1].status
                            : null;

                        return (
                          <div key={student.id} className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {student.first_name} {student.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">{statusText(lastStatus)}</p>
                              </div>
                              <p className="text-xs text-muted-foreground">{progressPercent}%</p>
                            </div>

                            <div className="h-2 rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-accent transition-all"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
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