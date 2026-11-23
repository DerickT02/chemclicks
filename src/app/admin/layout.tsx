import { getTeacherAccessRedirect } from "@/lib/auth/teacher-access";
import { getAuthUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Standard access tokens don't carry the user's email confirmation timestamp.
  const { data, error } = await getAuthUser();
  const redirectPath = getTeacherAccessRedirect(error ? null : data.user);

  if (redirectPath) {
    redirect(redirectPath);
  }

  return <div className="min-h-screen bg-background">{children}</div>;
}
