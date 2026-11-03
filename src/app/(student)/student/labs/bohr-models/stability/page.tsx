import type { Metadata } from "next";
import BohrLessonPage from "@/components/bohr-models/BohrLessonPage";

export const metadata: Metadata = {
  title: "Bohr Model Stability — ChemClicks",
  description: "Explore noble-gas stability, neutral charge, and ionic charge.",
};

export default function BohrModelStabilityPage() {
  return <BohrLessonPage mode="stability" />;
}

