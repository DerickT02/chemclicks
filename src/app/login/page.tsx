import Link from "next/link";
import {
  AuthCard,
  AuthFooter,
  AuthPageLayout,
  authAccentCtaClassName,
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
          <Link href="/login/teacher" className={authAccentCtaClassName}>
            Teacher
          </Link>
          <Link href="/login/student" className={authAccentCtaClassName}>
            Student
          </Link>
        </div>
      </AuthCard>
    </AuthPageLayout>
  );
}
