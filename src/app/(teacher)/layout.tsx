import { getTeacherAccessRedirectFromClaims } from "@/lib/auth/teacher-access";
import { getAuthClaims } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function TeacherGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data } = await getAuthClaims();
  const redirectPath = getTeacherAccessRedirectFromClaims(data?.claims ?? null);

  if (redirectPath) {
    redirect(redirectPath);
  }

  return <div className="min-h-screen bg-background">{children}</div>;
}
