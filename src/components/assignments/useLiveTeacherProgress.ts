"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeTeacherClass } from "@/lib/teacher-class-updates";

const FALLBACK_INTERVAL_MS = 60_000;
const MAX_RETRY_MS = 300_000;
const REQUEST_TIMEOUT_MS = 15_000;
const DEBOUNCE_MS = 250;
const MIN_REQUEST_GAP_MS = 2_000;

type Options = {
  classId?: string;
  resource?: "roster" | "progress";
  assignmentId?: string;
  enabled?: boolean;
};

type Snapshot<T> = { url: string; seed: T | null; data: T | null; failed: boolean };

// Server-rendered snapshots avoid a redundant mount fetch. Broadcasts are only
// invalidation hints; every data read still checks teacher ownership server-side.
export function useLiveTeacherProgress<T>(url: string, initialData: T | null, {
  classId, resource = "progress", assignmentId, enabled = true,
}: Options = {}): { data: T | null; failed: boolean } {
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);
  const latestSnapshot = useRef<Snapshot<T> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let inFlight = false;
    let dirty = false;
    let failures = 0;
    let notBefore = 0;
    let lastRequest = -Infinity;
    const previous = latestSnapshot.current;
    const matching = previous?.url === url && previous.seed === initialData;
    let lastData = matching ? previous.data : initialData;
    let lastJson = JSON.stringify(lastData);
    let lastFailed = matching ? previous.failed : initialData === null;
    let controller: AbortController | null = null;
    let requestTimeout: number | undefined;
    let fallback: number | undefined;
    let queued: number | undefined;

    function publish(data: T | null, failed: boolean) {
      const json = JSON.stringify(data);
      if (json === lastJson && failed === lastFailed) return;
      lastJson = json;
      lastData = data;
      lastFailed = failed;
      const next = { url, seed: initialData, data, failed };
      latestSnapshot.current = next;
      setSnapshot(next);
    }

    function scheduleFallback() {
      window.clearTimeout(fallback);
      fallback = window.setTimeout(() => void refresh(), Math.min(FALLBACK_INTERVAL_MS * 2 ** failures, MAX_RETRY_MS));
    }

    function invalidate() {
      dirty = true;
      if (disposed || inFlight || queued !== undefined || document.visibilityState === "hidden" || !navigator.onLine) return;
      // Fixed-window coalescing cannot starve under a continuous event stream.
      const delay = Math.max(DEBOUNCE_MS, notBefore - Date.now(), lastRequest + MIN_REQUEST_GAP_MS - Date.now());
      queued = window.setTimeout(() => { queued = undefined; void refresh(); }, delay);
    }

    async function refresh() {
      if (disposed || inFlight) return;
      if (document.visibilityState === "hidden" || !navigator.onLine) { scheduleFallback(); return; }
      if (Date.now() < notBefore) { invalidate(); return; }
      window.clearTimeout(queued);
      queued = undefined;
      window.clearTimeout(fallback);
      dirty = false;
      inFlight = true;
      lastRequest = Date.now();
      controller = new AbortController();
      requestTimeout = window.setTimeout(() => controller?.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok || response.redirected) throw new Error("Data unavailable");
        const data: T = await response.json();
        if (!disposed) {
          failures = 0;
          notBefore = 0;
          publish(data, false);
        }
      } catch {
        if (!disposed) {
          failures = Math.min(failures + 1, 3);
          notBefore = Date.now() + Math.min(FALLBACK_INTERVAL_MS * 2 ** failures, MAX_RETRY_MS);
          publish(lastData, true);
        }
      } finally {
        window.clearTimeout(requestTimeout);
        inFlight = false;
        if (!disposed) {
          scheduleFallback();
          if (dirty) invalidate();
        }
      }
    }

    // Missing SSR data (including a newly expanded history) needs an immediate
    // read. Otherwise wait for subscription catch-up or the fallback timer.
    if (initialData === null) void refresh();
    else scheduleFallback();
    let unsubscribe: (() => void) | undefined;
    if (classId) {
      try {
        unsubscribe = subscribeTeacherClass(classId, change => {
          if (change.kind === "progress" && (resource === "roster"
            || (assignmentId && change.assignmentId && assignmentId !== change.assignmentId))) return;
          invalidate();
        });
      } catch {
        // Missing/unavailable Realtime must never break the read-only fallback.
      }
    }
    const resume = () => invalidate();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true;
      window.clearTimeout(fallback);
      window.clearTimeout(queued);
      window.clearTimeout(requestTimeout);
      controller?.abort();
      unsubscribe?.();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
    };
  }, [url, initialData, classId, resource, assignmentId, enabled]);

  if (snapshot?.url === url && snapshot.seed === initialData) return { data: snapshot.data, failed: snapshot.failed };
  return { data: initialData, failed: initialData === null };
}
