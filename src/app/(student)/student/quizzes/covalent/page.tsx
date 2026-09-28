import type { Metadata } from "next";
import LewisQuizPage from "@/components/quiz/lewis/LewisQuizPage";

export const metadata: Metadata = {
  title: "Covalent Compounds Quiz | ChemClicks",
  description:
    "Check your understanding of valence electrons, Lewis dot diagrams, and covalent bonds.",
};
export const dynamic = "force-dynamic";

export default function CovalentCompoundsQuizPage() {
  return <LewisQuizPage kind="covalent" />;
}
