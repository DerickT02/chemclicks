import type { Metadata } from "next";
import GraduatedCylinder from "@/components/measurement/GraduatedCylinder";

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
        </header>

        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground">Graduated Cylinder</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">
            Read at the bottom of the meniscus. Drag to set the water level.
          </p>
          <GraduatedCylinder />
        </article>
      </div>
    </div>
  );
}
