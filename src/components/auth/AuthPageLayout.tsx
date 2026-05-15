import type { ComponentProps, ReactNode } from "react";

export const authInputClassName =
  "rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring";

/** Matches navbar “Sign in” and homepage “Get Started” accent CTAs. */
export const authAccentCtaClassName =
  "inline-flex w-full items-center justify-center rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const authPrimaryButtonClassName = authAccentCtaClassName;

/** Inline links / text buttons below the form (e.g. Create account, Forgot password) */
export const authSecondaryLinkClassName =
  "self-start text-left text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";

export function AuthPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      {children}
    </div>
  );
}

export function AuthCard({
  title,
  children,
  footer,
}: {
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
      <h1 className={`mb-6 font-semibold text-foreground`}>
        {title}
      </h1>
      {children}
      {footer}
    </div>
  );
}

const authInputErrorClassName =
  "border-destructive focus:border-destructive focus:ring-destructive";

/** Form-level validation or auth failure message (below fields, above actions). */
export function AuthFormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

export function AuthField({
  label,
  id,
  error,
  ...inputProps
}: {
  label: string;
  id: string;
  error?: string;
} & Omit<ComponentProps<"input">, "id" | "className">) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </label>
      <input
        id={id}
        className={`${authInputClassName} ${error ? authInputErrorClassName : ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...inputProps}
      />
      {error ? (
        <p
          id={`${id}-error`}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AuthPrimaryButton({
  children,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="submit"
      className={authPrimaryButtonClassName}
      {...props}
    >
      {children}
    </button>
  );
}

export function AuthFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mt-6 border-t border-border pt-6 text-sm ${className}`}
    >
      {children}
    </div>
  );
}
