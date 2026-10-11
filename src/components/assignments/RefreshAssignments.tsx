"use client";

import { useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Dashboard updates are explicit or on focus; active exercises enforce their own deadlines. */
export default function RefreshAssignments({ label = "Refresh assignments" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);

  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  return (
    <button type="button" onClick={refresh} disabled={pending} aria-busy={pending}
      className="rounded-md border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60">
      {pending ? "Refreshing…" : label}
    </button>
  );
}
