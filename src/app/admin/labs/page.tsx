import type { Metadata } from "next";
import LabsIndex from "@/components/labs/LabsIndex";

export const metadata: Metadata = {
  title: "Labs — ChemClicks",
  description: "Interactive chemistry labs: Bohr Models, Lewis Structures, and Measurement.",
};

// The same labs students practise in, so a teacher can see what the class sees.
export default function TeacherLabsPage() {
  return <LabsIndex basePath="/admin/labs" />;
}
