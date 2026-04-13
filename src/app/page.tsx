import Get_Started_Button from "@/components/homepage/Get_Started_Button";
import Lesson_Overview from "@/components/homepage/Lesson_Overview";
import Footer from "@/components/Footer";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      {/* Main Content Area */}
      <main className="flex w-full flex-grow flex-col">
        {/* Fills viewport below sticky navbar so divider / next sections stay off-screen until scroll */}
        <section className="mx-auto flex min-h-screen-below-nav w-full max-w-7xl flex-col items-center justify-center gap-10 px-4 py-16 md:flex-row md:items-center md:justify-between md:gap-6 lg:gap-8 lg:px-12">
          <div className="flex max-w-xl flex-col items-center text-center md:items-start md:text-left">
            <h1 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
              Master Chemistry with Interactive Lessons
            </h1>
            <p className="mb-2 max-w-md text-lg text-muted-foreground">
              Bohr Models, Lewis Structures, and measurement lab - all in one place. Built for the classroom.
            </p>
            <Get_Started_Button />
          </div>
          <div className="flex shrink-0 justify-center md:justify-end md:-translate-x-16 md:-translate-y-5 lg:-translate-x-24 lg:-translate-y-6">
            <Image
              src="/favicon.svg"
              alt="ChemClicks logo"
              width={400}
              height={400}
              className="h-52 w-52 md:h-64 md:w-64 lg:h-80 lg:w-80 xl:h-96 xl:w-96"
              priority
            />
          </div>
        </section>

        {/* Newsletter placeholder — keep no vertical padding so it does not steal viewport from the hero */}
        <section className="mx-auto w-full max-w-7xl px-8 md:px-16">
          <div className="w-full" />
        </section>

        {/* Divider + lesson content — #features lands here (not deep inside overview) */}
        <section id="features" className="w-full border-t border-border">
          <Lesson_Overview />
        </section>
      </main>

      <Footer />
    </div>
  );
}