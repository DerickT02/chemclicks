import type { Metadata } from "next";
import MeasurementLab from "@/components/labs/MeasurementLab";

export const metadata: Metadata = {
  title: "Measurement Lab | ChemClicks",
  description: "Compare ruler and graduated cylinder scales to explore measurement precision.",
};

// Activities must be opened through a class assignment with server access checks.
export default function MeasurementLabPage() {
  return <MeasurementLab />;
}
