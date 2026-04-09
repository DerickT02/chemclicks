import Lesson_Overview from "@/components/homepage/Lesson_Overview";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-[#0d1117]">
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
        <section className="w-full border-t border-[#30363d]">
          <Lesson_Overview />
        </section>
      </main>

      <Footer />
    </div>
  );
}