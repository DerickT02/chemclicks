import type { Metadata } from "next";
import BohrLessonPage from "@/components/bohr-models/BohrLessonPage";

export const metadata: Metadata = {
  title: "Bohr Model Introduction — ChemClicks",
  description: "Explore neutral Bohr models for the first 20 elements.",
};

export default function BohrModelIntroductionPage() {
  return <BohrLessonPage mode="intro" />;
}

