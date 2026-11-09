import type { Metadata } from "next";
import BohrLessonPage from "@/components/bohr-models/BohrLessonPage";

export const metadata: Metadata = {
  title: "Bohr Model Introduction — ChemClicks",
  description: "Explore neutral Bohr models for the first 20 elements.",
};

/** Compatibility entry for the former Bohr Models route. */
export default function BohrModelsPage() {
  return <BohrLessonPage mode="intro" />;
}
