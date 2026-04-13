import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
      <h1 className="text-lg font-semibold text-foreground">
        Something went wrong
      </h1>
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        We couldn&apos;t complete sign-in. The link may have expired or already been
        used.
      </p>
      <Link
        href="/login/teacher"
        className="text-sm font-medium text-foreground underline underline-offset-4"
      >
        Back to login
      </Link>
    </div>
  );
}
