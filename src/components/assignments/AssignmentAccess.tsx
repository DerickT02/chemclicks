"use client";

import Link from "next/link";
import LocalizedTimestamp from "@/components/datetime/LocalizedTimestamp";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from "react";

type Props = {
  closesAt: string | null;
  children: ReactNode;
  contentType?: "exploration" | "quiz";
};

const MAX_TIMER_DELAY = 2_147_483_647;

/** Client deadline UX only. Server authorization/time checks remain authoritative. */
export default function AssignmentAccess({ closesAt, children, contentType = "exploration" }: Props) {
  const router = useRouter();
  const deadline = closesAt === null ? null : Date.parse(closesAt);
  const getClosed = useCallback(() => deadline !== null
    && (!Number.isFinite(deadline) || Date.now() >= deadline), [deadline]);
  // Match SSR and the first hydration render; invalid dates fail closed in both.
  const getServerClosed = useCallback(() => deadline !== null && !Number.isFinite(deadline), [deadline]);
  const subscribe = useCallback((notify: () => void) => {
    if (deadline === null || !Number.isFinite(deadline)) return () => {};
    const closingTime = deadline;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    function checkDeadline() {
      clearTimeout(timeout);
      notify();
      const remaining = closingTime - Date.now();
      if (remaining > 0) {
        // Browser timers cannot represent delays beyond roughly 24 days.
        timeout = setTimeout(checkDeadline, Math.min(remaining, MAX_TIMER_DELAY));
      }
    }
    checkDeadline();
    window.addEventListener("focus", checkDeadline);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("focus", checkDeadline);
    };
  }, [deadline]);
  const closed = useSyncExternalStore(subscribe, getClosed, getServerClosed);

  useEffect(() => {
    if (closed) router.refresh();
    const interval = setInterval(() => router.refresh(), 30_000);
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [closed, router]);

  if (closed) {
    return (
      <div role="status" className="space-y-3">
        <p>{contentType === "quiz"
          ? "This quiz is closed. You cannot submit more answers."
          : "This assignment is no longer available. You cannot save further exploration attempts."}</p>
        <p className="text-sm text-muted-foreground">
          {contentType === "quiz"
            ? "Quiz answers and results are not saved or visible to your teacher."
            : "Previously saved exploration attempts are retained. An unconfirmed save should not be treated as completed."}
        </p>
        <Link href="/student" className="text-foreground underline">Return to assignments</Link>
      </div>
    );
  }
  return (
    <>
      {closesAt && deadline !== null && Number.isFinite(deadline) && (
        <p className="text-sm text-muted-foreground">
          Closes <LocalizedTimestamp value={closesAt} />.
          No further work can be submitted after closing.
        </p>
      )}
      {children}
    </>
  );
}
