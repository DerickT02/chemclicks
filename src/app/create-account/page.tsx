import Link from "next/link";
import {
  AuthCard,
  AuthFooter,
  AuthPageLayout,
  authAccentCtaClassName,
} from "@/components/auth/AuthPageLayout";

export default function CreateAccountRolePage() {
  return (
    <AuthPageLayout>
      <AuthCard
        title="Create an account as"
        footer={
          <>
            <AuthFooter className="text-muted-foreground">
              Teacher?{" "}
              <Link
                href="/login/teacher"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </AuthFooter>
            <AuthFooter className="text-muted-foreground">
              Student?{" "}
              <Link
                href="/login/student"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </AuthFooter>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Link href="/create-account/teacher" className={authAccentCtaClassName}>
            Teacher
          </Link>
          <Link href="/create-account/student" className={authAccentCtaClassName}>
            Student
          </Link>
        </div>
      </AuthCard>
    </AuthPageLayout>
  );
}
