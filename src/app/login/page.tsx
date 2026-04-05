import Link from "next/link";
import {
  AuthCard,
  AuthField,
  AuthFooter,
  AuthPageLayout,
  AuthPrimaryButton,
  authSecondaryLinkClassName,
} from "@/components/auth/AuthPageLayout";

export default function LoginPage() {
  return (
    <AuthPageLayout>
      <AuthCard
        title="Login"
        footer={
          <AuthFooter className="flex flex-col gap-2">
            <Link href="/create-account" className={authSecondaryLinkClassName}>
              Create account
            </Link>
            <button type="button" className={authSecondaryLinkClassName}>
              Forgot password?
            </button>
          </AuthFooter>
        }
      >
        <form className="flex flex-col gap-4">
          <AuthField
            id="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
          />
          <AuthField
            id="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <AuthPrimaryButton>Sign in</AuthPrimaryButton>
        </form>
      </AuthCard>
    </AuthPageLayout>
  );
}
