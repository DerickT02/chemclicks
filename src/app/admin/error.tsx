"use client";

import { AuthCard, AuthFooter, AuthPageLayout } from "@/components/auth/AuthPageLayout";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AuthPageLayout>
      <AuthCard
        title={<span className="block text-center text-2xl">Couldn&apos;t load your classes</span>}
        footer={
          <AuthFooter className="text-center text-muted-foreground">
            If this keeps happening, please try again shortly.
          </AuthFooter>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="mb-4 text-center text-sm text-muted-foreground">
            {error.message || "Something went wrong while loading your classrooms."}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mx-auto inline-flex w-fit rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Try again
          </button>
        </div>
      </AuthCard>
    </AuthPageLayout>
  );
}
