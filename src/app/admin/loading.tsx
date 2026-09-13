export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground md:px-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Classrooms</h1>
        <p className="mt-3 text-sm text-muted-foreground">Loading your classes…</p>
      </div>
    </div>
  );
}
