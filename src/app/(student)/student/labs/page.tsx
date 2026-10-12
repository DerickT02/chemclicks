import type { Metadata } from "next";
import LabsIndex from "@/components/labs/LabsIndex";

export const metadata: Metadata = {
  title: "Practice labs — ChemClicks",
  description: "Interactive chemistry labs: Bohr Models, Lewis Structures, and Measurement.",
};

export default function LabsPage() {
  return <LabsIndex basePath="/student/labs" />;
}
