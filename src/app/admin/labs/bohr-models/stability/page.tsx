import type { Metadata } from "next";
import BohrLessonPage from "@/components/bohr-models/BohrLessonPage";

export const metadata: Metadata = {
  title: "Bohr Model Stability Preview — ChemClicks",
  description: "Preview the Bohr Model Stability practice lesson.",
};

export default function TeacherBohrModelStabilityPage() {
  return <BohrLessonPage mode="stability" />;
}

