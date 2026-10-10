"use client";

import { useState, type ReactNode } from "react";
import { useViewerTimeZone } from "@/components/datetime/useViewerTimeZone";

type Props = { children: (zone: string) => ReactNode };
export default function TimeZoneBoundary({ children }: Props) {
  const detected = useViewerTimeZone();
  const [zone, setZone] = useState<string | null>(null);
  // Pin entry to the detected zone for this form's lifetime; focus cannot reinterpret drafts.
  if (zone === null && detected !== null && detected !== "unavailable") setZone(detected);
  if (zone !== null) return children(zone);
  if (detected === null) return <p className="text-sm text-muted-foreground">Detecting your time zone. JavaScript is needed for local-time scheduling.</p>;
  if (detected === "unavailable") return <div className="space-y-2">
    <p role="alert">Your time zone could not be detected.</p>
    <button type="button" onClick={() => setZone("UTC")} className="rounded-md border border-border px-3 py-2 text-sm">Use UTC instead</button>
  </div>;
  return children(detected);
}
