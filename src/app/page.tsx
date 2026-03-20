import Lesson_Overview from "../components/homepage/Lesson_Overview";


// caeden's comment

//dericks comment

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-[#0d1117]">
      <main className="flex w-full flex-col py-20 px-8 md:px-16">
          {/* --- Feature Cards Section --- */}
          <div className="w-full">
            <Lesson_Overview />
          </div>
      </main>
    </div>
  );
}  