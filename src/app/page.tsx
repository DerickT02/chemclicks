export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-grow flex-col items-center justify-center py-20 px-4">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white">
            Welcome to ChemClicks
          </h1>
          <p className="max-w-md text-lg text-gray-600 dark:text-gray-400">
            Your chemistry learning platform
          </p>
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-300">
        <div className="mx-auto max-w-7xl px-8 py-16">
          <div className="mb-6 text-xs uppercase tracking-wide text-slate-500">
            Footer Boilerplate
          </div>

          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-6 md:p-8">
            <h2 className="mb-2 text-lg font-semibold text-white">Footer scaffold</h2>
            <p className="mb-6 text-sm text-slate-400">
              Placeholder layout only. Replace each section with real content.
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-md border border-slate-800 p-4 text-sm text-slate-400">
                Brand / About
              </div>
              <div className="rounded-md border border-slate-800 p-4 text-sm text-slate-400">
                Links column 1
              </div>
              <div className="rounded-md border border-slate-800 p-4 text-sm text-slate-400">
                Links column 2
              </div>
              <div className="rounded-md border border-slate-800 p-4 text-sm text-slate-400">
                Newsletter / CTA
              </div>
            </div>

            <div className="mt-6 rounded-md border border-slate-800 p-4 text-sm text-slate-400">
              Bottom bar (copyright, legal links, socials)
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
