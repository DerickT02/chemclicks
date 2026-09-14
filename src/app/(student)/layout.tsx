import { redirect } from "next/navigation";
import { getStudentSession } from "@/lib/auth/student-session";

export default async function StudentGroupLayout({ children }: Readonly<{
  children: React.ReactNode;
}>) {
  if (!(await getStudentSession())) redirect("/login/student");
  // Each data reader also verifies current membership and availability.
  return <div className="min-h-screen bg-background">{children}</div>;
}
