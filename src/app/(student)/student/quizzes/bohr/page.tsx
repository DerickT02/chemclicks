import type { Metadata } from "next";
import BohrModelsQuiz from "@/components/quiz/bohr/BohrModelsQuiz";

export const metadata: Metadata = {
  title: "Bohr Models Quiz | ChemClicks",
  description:
    "Check your understanding of Bohr models, electron shells, and the nucleus.",
};

export default function BohrModelQuizPage() {
  return (
    <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-foreground">
            Bohr Models Quiz
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete this quiz before moving on to the next section.
          </p>
        </header>

        <BohrModelsQuiz />
      </div>
    </div>
  );
}