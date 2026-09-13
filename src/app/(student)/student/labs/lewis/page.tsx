import type { Metadata } from "next";
import LewisDotExplorer from "@/components/lewis/LewisDotExplorer";

export const metadata: Metadata = {
  title: "Lewis Diagram | ChemClicks",
  description: "Explore the valence electrons of the first 20 elements.",
};

export default function LewisDotDiagramsPage() {
  return (
    <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-foreground">
            Lewis Diagram
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            The Lewis diagram shows only the valence electrons from the Bohr model.
          </p>
        </header>

        <LewisDotExplorer />
      </div>
    </div>
  );
}
