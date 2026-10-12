import type { Metadata } from "next";
import BohrModelsLab from "@/components/labs/BohrModelsLab";

export const metadata: Metadata = {
  title: "Bohr Models — ChemClicks",
  description:
    "Introduction to electron shells. Explore interactive Bohr atomic models for elements 1–20.",
};

export default function TeacherBohrModelsLabPage() {
  return <BohrModelsLab />;
}
