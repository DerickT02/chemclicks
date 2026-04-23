import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background p-10 text-foreground">
      <h1 className="text-3xl font-semibold">Classrooms</h1>
      <p className="mb-8 mt-2 text-muted-foreground">
        Teacher admin view. Create classes, share classroom codes, and see where students are in the lesson.
      </p>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Left Panel - Your Classes */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-xl font-medium">Your classes</h2>
          <p className="mt-5 text-muted-foreground">Class list component goes here</p>
          
          <div className="mt-10">
            <h3 className="text-lg font-medium">Add a class</h3>
            <p className="mt-3 text-muted-foreground">
              Set up a new class and get a code to share with students.
            </p>
            <Link
              href="/admin/create-class"
              className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Create class
            </Link>
          </div>
        </div>

        {/* Right Panel - Class Detail */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-xl font-medium">Chemistry Period 1</h2>
          <p className="mt-5 text-muted-foreground">Class detail component goes here</p>
          
          <div className="mt-10">
            <h3 className="text-lg font-medium">Active students</h3>
            <p className="mt-5 text-muted-foreground">Student list component goes here</p>
          </div>
        </div>
      </div>
    </div>
  );
}