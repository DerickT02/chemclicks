"use client";

import { useSyncExternalStore } from "react";
import { validateTimeZone } from "@/lib/datetime/time-zone";

const listeners = new Set<() => void>();
let cached: string | null = null;
function readZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    validateTimeZone(zone);
    return zone;
  } catch { return "unavailable"; }
}
function onFocus() {
  const next = readZone();
  if (next === cached) return;
  cached = next;
  listeners.forEach(notify => notify());
}
function subscribe(notify: () => void) {
  listeners.add(notify);
  if (listeners.size === 1) window.addEventListener("focus", onFocus);
  return () => {
    listeners.delete(notify);
    if (!listeners.size) { window.removeEventListener("focus", onFocus); cached = null; }
  };
}
function snapshot(): string { return cached ?? (cached = readZone()); }
const serverSnapshot = () => null;

/** Explicit UTC SSR fallback; browser-zone rendering starts only after hydration. */
export function useViewerTimeZone(): string | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
