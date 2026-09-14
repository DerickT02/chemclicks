import type { Metadata } from "next";
import Link from "next/link";
import MeasurementQuiz from "@/components/measurement/MeasurementQuiz";

export const metadata: Metadata = {
  title: "Measurement Questions | ChemClicks",
  description:
    "Read a simulated ruler or graduated cylinder and check your measurement.",
};

export default function MeasurementQuestionsPage() {
  return (
    <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <Link
            href="/student/labs/measurement"
            className="w-fit rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden="true">← </span>
            Back to Measurement Lab
          </Link>
          <h1 className="text-3xl font-semibold text-foreground">Measurement Questions</h1>
          <p className="text-sm text-muted-foreground">
            Read the scale on a simulated instrument, then report your measurement to the
            precision the question asks for.
          </p>
        </header>

        <MeasurementQuiz />
      </div>
    </div>
  );
}
