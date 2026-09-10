"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function AccountCreatedPopup() {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (searchParams.get("accountCreated") !== "true") return null;

  function dismiss() {
    router.replace("/");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="presentation"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-created-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="account-created-title" className="text-lg font-semibold text-foreground">
          Account successfully created
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your student account is ready to use.
        </p>
        <button
          type="button"
          className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          onClick={dismiss}
        >
          Continue
        </button>
      </div>
    </div>
  );
}