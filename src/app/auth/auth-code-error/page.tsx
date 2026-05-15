import ErrorPage from "@/components/error/ErrorPage";

export default function AuthCodeErrorPage() {
  return (
    <ErrorPage
      title="Something went wrong"
      description="We couldn&apos;t complete sign-in. The link may have expired or already been used."
      backHref="/login/teacher"
      backLabel="Back to login"
    />
  );
}
