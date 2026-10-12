import type { Metadata } from "next";
import MeasurementLab from "@/components/labs/MeasurementLab";

export const metadata: Metadata = {
  title: "Measurement Lab | ChemClicks",
  description: "Compare ruler and graduated cylinder scales to explore measurement precision.",
};

export default function TeacherMeasurementLabPage() {
  return <MeasurementLab />;
}
