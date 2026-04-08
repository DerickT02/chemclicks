import Lesson_Overview from "../components/homepage/Lesson_Overview";
import HomepageNavbar from "../components/Navbars/HomepageNavbar";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-[#0d1117]">
      <HomepageNavbar />
      {/* Main Content Area */}
      <main className="flex-grow flex flex-col w-full">
        
        {/* --- Hero Section --- */}
        <section className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <h1 className="mb-4 text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            Welcome to ChemClicks
          </h1>
          <p className="max-w-md text-lg text-gray-600 dark:text-gray-400">
            Your chemistry learning platform
          </p>
        </section>

        {/* --- Newsletter Section --- */}
        <section className="py-20 px-8 md:px-16 w-full max-w-7xl mx-auto">
          <div className="w-full">
          </div>
        </section>

        {/* --- Lesson Overview Section --- */}
        <section id ="features" className="w-full border-t border-[#30363d]">
          <Lesson_Overview />
        </section>
      </main>

      {/* --- Footer Section --- */}
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