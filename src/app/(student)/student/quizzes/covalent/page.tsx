import type { Metadata } from "next";
import LewisQuizPage from "@/components/quiz/lewis/LewisQuizPage";

export const metadata: Metadata = {
  title: "Covalent Compounds Quiz | ChemClicks",
  description:
    "Check your understanding of valence electrons, Lewis dot diagrams, and covalent bonds.",
};
export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ assignmentId?: string | string[] }>;
};

export default async function CovalentCompoundsQuizPage({ searchParams }: Props = {}) {
  const params = searchParams ? await searchParams : {};
  const rawAssignmentId = params.assignmentId;
  const assignmentId = Array.isArray(rawAssignmentId) ? rawAssignmentId[0] : rawAssignmentId;
  return <LewisQuizPage kind="covalent" assignmentId={assignmentId} />;
}
