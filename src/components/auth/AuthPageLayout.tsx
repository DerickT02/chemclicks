import type { ComponentProps, ReactNode } from "react";

export const authInputClassName =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

export const authPrimaryButtonClassName =
  "mt-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

/** Inline links / text buttons below the form (e.g. Create account, Forgot password) */
export const authSecondaryLinkClassName =
  "self-start text-left text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100";

export function AuthPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      {children}
    </div>
  );
}

export function AuthCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h1>
      {children}
      {footer}
    </div>
  );
}

const authInputErrorClassName =
  "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500";

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
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
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
          className="text-sm text-red-600 dark:text-red-400"
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
      className={`mt-6 border-t border-zinc-200 pt-6 text-sm dark:border-zinc-800 ${className}`}
    >
      {children}
    </div>
  );
}
