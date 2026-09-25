export default function LewisQuizLoading() {
  return (
    <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-foreground">
            Lewis Structures & Bonding Quiz
          </h1>
          <p className="text-sm text-muted-foreground">Loading questions…</p>
        </header>
      </div>
    </div>
  );
}
