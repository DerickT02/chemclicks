import type { Metadata } from "next";
import BohrLessonPage from "@/components/bohr-models/BohrLessonPage";

export const metadata: Metadata = {
  title: "Bohr Model Introduction Preview — ChemClicks",
  description: "Preview the Bohr Model Introduction practice lesson.",
};

/** Compatibility entry for the former Bohr Models preview route. */
export default function TeacherBohrModelIntroductionPage() {
  return <BohrLessonPage mode="intro" />;
}
