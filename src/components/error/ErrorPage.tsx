import Link from "next/link";
import { AuthCard, AuthFooter, AuthPageLayout } from "@/components/auth/AuthPageLayout";

type ErrorPageProps = {
  title?: string;
  description?: string;
  footerText?: string;
  backHref?: string;
  backLabel?: string;
};

export default function ErrorPage({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  footerText = "If this keeps happening, please try again shortly.",
  backHref = "/",
  backLabel = "Back to home",
}: ErrorPageProps) {
  return (
    <AuthPageLayout>
      <AuthCard
        title={<span className="block text-center text-2xl">{title}</span>}
        footer={
          <AuthFooter className="text-muted-foreground text-center">{footerText}</AuthFooter>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="mb-4 text-center text-sm text-muted-foreground">
            {description}
          </p>
          <Link
            href={backHref}
            className="inline-flex w-fit rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 mx-auto"
          >
            {backLabel}
          </Link>
        </div>
      </AuthCard>
    </AuthPageLayout>
  );
}
