"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = { nextChangeAt?: number | null; checkedAt?: number };

/** Re-read authorized server data; browser timers never grant assignment access. */
export default function RefreshAssignments({ nextChangeAt = null, checkedAt }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => {
    startTransition(() => {
      setError(null);
      try {
        router.refresh();
      } catch {
        setError("Could not refresh assignments. Reload this page to try again.");
      }
    });
  }, [router]);

  useEffect(() => {
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    const delay = nextChangeAt === null ? Infinity : Math.max(0, nextChangeAt - Date.now() + 25);
    // Long deadlines are reconsidered on each fresh server snapshot, without timer overflow.
    const deadline = delay < 30_000 ? window.setTimeout(refresh, delay) : null;
    return () => {
      window.clearInterval(interval);
      if (deadline !== null) window.clearTimeout(deadline);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh, nextChangeAt, checkedAt]);

  return (
    <div className="space-y-2">
      <button type="button" onClick={refresh} disabled={pending} aria-busy={pending}
        className="rounded-md border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60">
        {pending ? "Refreshing assignments…" : "Refresh assignments"}
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
