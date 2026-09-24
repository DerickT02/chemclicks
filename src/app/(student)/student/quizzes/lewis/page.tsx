import type { Metadata } from "next";
import LewisBondingQuiz from "@/components/quiz/lewis/LewisBondingQuiz";

export const metadata: Metadata = {
  title: "Lewis Structures & Bonding Quiz | ChemClicks",
  description:
    "Check your understanding of valence electrons, Lewis dot diagrams, covalent bonds, and ionic bonding.",
};

export default function LewisBondingQuizPage() {
  return (
    <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-foreground">
            Lewis Structures & Bonding Quiz
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete this quiz before moving on to the next section.
          </p>
        </header>

        <LewisBondingQuiz />
      </div>
    </div>
  );
}
