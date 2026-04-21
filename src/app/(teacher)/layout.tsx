import { getTeacherAccessRedirect } from "@/lib/auth/teacher-access";
import { getAuthUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function TeacherGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const {
    data: { user },
  } = await getAuthUser();
  const redirectPath = getTeacherAccessRedirect(user);

  if (redirectPath) {
    redirect(redirectPath);
  }

  return <div className="min-h-screen bg-background">{children}</div>;
}
