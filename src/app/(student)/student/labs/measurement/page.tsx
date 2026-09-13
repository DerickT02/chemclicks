import type { Metadata } from "next";
import Link from "next/link";
import GraduatedCylinder from "@/components/measurement/GraduatedCylinder";
import PrecisionRuler from "@/components/measurement/PrecisionRuler";

export const metadata: Metadata = {
  title: "Measurement Lab | ChemClicks",
  description: "Practice reading a graduated cylinder at the bottom of the meniscus.",
};

export default function MeasurementLabPage() {
  return (
    <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-foreground">Measurement Lab</h1>
          <p className="text-sm text-muted-foreground">
            Ready to test yourself?{" "}
            <Link
              href="/student/labs/measurement/questions"
              className="rounded-sm font-medium text-accent underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Practice measurement questions
            </Link>
          </p>
        </header>

        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground">Graduated Cylinder</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">
            Read at the bottom of the meniscus. Drag to set the water level.
          </p>
          <GraduatedCylinder />
        </article>

        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground">Precision Ruler</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">
            Drag the cursor, or focus it and use the arrow keys, to read the ruler to the
            hundredth of a centimeter.
          </p>
          <PrecisionRuler />
        </article>
      </div>
    </div>
  );
}
