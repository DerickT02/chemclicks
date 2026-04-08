import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Something went wrong
      </h1>
      <p className="max-w-sm text-center text-sm text-zinc-600 dark:text-zinc-400">
        We couldn&apos;t complete sign-in. The link may have expired or already been
        used.
      </p>
      <Link
        href="/login/teacher"
        className="text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
      >
        Back to login
      </Link>
    </div>
  );
}
