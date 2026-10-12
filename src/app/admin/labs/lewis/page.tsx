import type { Metadata } from "next";
import LewisLab from "@/components/labs/LewisLab";

export const metadata: Metadata = {
  title: "Lewis Structures — ChemClicks",
  description:
    "Explore Lewis diagrams for elements 1–20, then see how atoms form ionic and covalent bonds.",
};

export default function TeacherLewisLabPage() {
  return <LewisLab />;
}
