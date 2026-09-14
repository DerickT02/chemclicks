"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type Props = { closesAt: string | null; children: ReactNode };

/** Revalidate open tabs as teachers change dates, and hide content at closing. */
export default function AssignmentAccess({ closesAt, children }: Props) {
  const router = useRouter();
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    function checkDeadline() {
      if (!closesAt) return;
      const remaining = Date.parse(closesAt) - Date.now();
      if (remaining <= 0) {
        setClosed(true);
        router.refresh();
      } else {
        // Browser timers cannot represent delays beyond roughly 24 days.
        timeout = setTimeout(checkDeadline, Math.min(remaining, 2_147_483_647));
      }
    }
    checkDeadline();
    const interval = setInterval(() => router.refresh(), 30_000);
    const onFocus = () => { checkDeadline(); router.refresh(); };
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [closesAt, router]);

  if (closed) {
    return (
      <div role="status" className="space-y-3">
        <p>This assignment is no longer available.</p>
        <Link href="/student" className="text-accent underline">Return to assignments</Link>
      </div>
    );
  }
  return children;
}
