import Link from "next/link";
import { AuthCard, AuthFooter, AuthPageLayout } from "@/components/auth/AuthPageLayout";

export default function NotFoundPage() {
  return (
    <AuthPageLayout>
      <AuthCard
        title={
            <>
              <span className="block text-8xl text-center">404</span>
              <span className="block text-center text-2xl">Page not found</span>
            </>
          }
        footer={
          <AuthFooter className="text-muted-foreground text-center">
            The link may be incorrect, expired, or the page may have moved.
          </AuthFooter>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground mb-4 text-center">
            We couldn&apos;t find the page you were looking for.
          </p>
          <Link
            href="/"
            className="inline-flex w-fit rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 mx-auto"
          >
            Go to home page
          </Link>
        </div>
      </AuthCard>
    </AuthPageLayout>
  );
}