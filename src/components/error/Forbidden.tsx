import Link from "next/link";
import { AuthCard, AuthFooter, AuthPageLayout } from "@/components/auth/AuthPageLayout";

export default function NotFoundPage() {
  return (
    <AuthPageLayout>
      <AuthCard
        title={
            <>
              <span className="block text-8xl text-center">403</span>
              <span className="block text-center text-2xl">Forbidden</span>
            </>
          }
        footer={
          <AuthFooter className="text-muted-foreground text-center">
            You may not be signed in as a teacher.
          </AuthFooter>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground mb-4 text-center">
            You do not have access to this page.
          </p>
          <Link
            href="/login/teacher"
            className="inline-flex w-fit rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 mx-auto"
          >
            Go to the teacher login page
          </Link>
        </div>
      </AuthCard>
    </AuthPageLayout>
  );
}