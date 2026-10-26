"use client";

import { useEffect, useState } from "react";
import { loginStudent } from "@/app/login/student/actions";

export const APPROVAL_CHECK_INTERVAL_MS = 10_000;

/**
 * While a pending student keeps the page open, retries sign-in until their
 * teacher approves them, then opens their assignments. Returns true once approved.
 */
export function useApprovalSignIn(studentID: string, code: string, enabled: boolean): boolean {
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      // Skip checks in background tabs; the next visible check catches up.
      if (document.visibilityState === "visible") {
        try {
          const result = await loginStudent(studentID, code);
          if (cancelled) return;
          if (result.ok) {
            setApproved(true);
            // Reload the document so shared layouts see the newly established session.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentionally discard pre-login layout state
            window.location.assign("/student");
            return;
          }
          // The student or class no longer exists; signing in by hand explains why.
          if (result.field === "studentID" || result.field === "code") return;
        } catch {
          // Transient failure: try again on the next check.
        }
      }
      if (!cancelled) timer = setTimeout(check, APPROVAL_CHECK_INTERVAL_MS);
    };
    timer = setTimeout(check, APPROVAL_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [studentID, code, enabled]);

  return approved;
}
