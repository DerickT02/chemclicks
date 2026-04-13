import Link from "next/link";
import {
  AuthCard,
  AuthFooter,
  AuthPageLayout,
} from "@/components/auth/AuthPageLayout";

export default function LoginRolePage() {
  return (
    <AuthPageLayout>
      <AuthCard
        title="Sign in as"
        footer={
          <AuthFooter className="text-muted-foreground">
            Teacher?{" "}
            <Link
              href="/create-account/teacher"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </AuthFooter>
        }
      >
        <div className="flex flex-col gap-3">
          <Link href="/login/teacher" className="rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
            Teacher
          </Link>
          <Link href="/login/student" className="rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
            Student
          </Link>
        </div>
      </AuthCard>
    </AuthPageLayout>
  );
}
