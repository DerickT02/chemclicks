export default function StudentGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // TODO: verify session and student role; redirect if unauthorized
  return <div className="min-h-screen bg-background">{children}</div>;
}
