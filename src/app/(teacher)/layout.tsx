export default function TeacherGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // TODO: verify session and teacher role; redirect if unauthorized
  return <div className="min-h-screen bg-background">{children}</div>;
}
