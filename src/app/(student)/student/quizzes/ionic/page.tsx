import type { Metadata } from "next";
import LewisQuizPage from "@/components/quiz/lewis/LewisQuizPage";

export const metadata: Metadata = {
  title: "Ionic Compounds Quiz | ChemClicks",
  description:
    "Check your understanding of valence electrons, ions, and ionic compounds.",
};
export const dynamic = "force-dynamic";

export default function IonicCompoundsQuizPage() {
  return <LewisQuizPage kind="ionic" />;
}
