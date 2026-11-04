"use client";

import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 5_000;
const REQUEST_TIMEOUT_MS = 15_000;

// Keep the server-rendered snapshot until a background read succeeds. Associate
// updates with their URL and seed so navigation/server refreshes cannot show old data.
export function useLiveTeacherProgress<T>(url: string, initialData: T | null): {
  data: T | null;
  failed: boolean;
} {
  const [snapshot, setSnapshot] = useState<{
    url: string;
    seed: T | null;
    data: T | null;
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let controller: AbortController | null = null;
    let requestTimeout: number | undefined;

    async function refresh() {
      if (disposed || inFlight || document.visibilityState === "hidden" || !navigator.onLine) return;
      inFlight = true;
      controller = new AbortController();
      requestTimeout = window.setTimeout(() => controller?.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok || response.redirected) throw new Error("Progress unavailable");
        const data: T = await response.json();
        if (!disposed) setSnapshot({ url, seed: initialData, data, failed: false });
      } catch {
        if (!disposed) {
          setSnapshot(previous => ({
            url,
            seed: initialData,
            data: previous?.url === url && previous.seed === initialData ? previous.data : initialData,
            failed: true,
          }));
        }
      } finally {
        window.clearTimeout(requestTimeout);
        inFlight = false;
      }
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const resume = () => void refresh();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.clearTimeout(requestTimeout);
      controller?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
    };
  }, [url, initialData]);

  if (snapshot?.url === url && snapshot.seed === initialData) {
    return { data: snapshot.data, failed: snapshot.failed };
  }
  return { data: initialData, failed: initialData === null };
}
