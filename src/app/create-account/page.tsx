import Link from "next/link";
import {
  AuthCard,
  AuthFooter,
  AuthPageLayout,
} from "@/components/auth/AuthPageLayout";

export default function CreateAccountRolePage() {
  return (
    <AuthPageLayout>
      <AuthCard
        title="Create account"
        footer={
          <AuthFooter className="text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </AuthFooter>
        }
      >
        <div className="flex flex-col gap-3">
          <Link href="/create-account/teacher" className="rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
            Teacher
          </Link>
          <Link href="/create-account/student" className="rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
            Student
          </Link>
        </div>
      </AuthCard>
    </AuthPageLayout>
  );
}
