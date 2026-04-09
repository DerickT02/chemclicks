import Get_Started_Button from "@/components/homepage/Get_Started_Button";
import Lesson_Overview from "@/components/homepage/Lesson_Overview";
import Footer from "@/components/Footer";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-[#0d1117]">
      {/* Main Content Area */}
      <main className="flex-grow flex flex-col w-full">
        
        {/* --- Hero Section --- */}
        <section className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <Image
            src="/favicon.svg"
            alt="ChemClicks logo"
            width={64}
            height={64}
            className="mb-5 h-16 w-16"
            priority
          />
          <h1 className="mb-4 text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            Master Chemistry with Interactive Lessons
          </h1>
          <p className="max-w-md text-lg text-gray-600 dark:text-gray-400">
            Bohr Models, Lewis Structures, and measurment lab - all in one place. Built for the classroom.
          </p>
          <Get_Started_Button />
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