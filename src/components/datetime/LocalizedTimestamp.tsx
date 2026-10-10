"use client";

import { useViewerTimeZone } from "@/components/datetime/useViewerTimeZone";
import { formatZonedTimestamp } from "@/lib/datetime/time-zone";
import { formatUtcTimestamp } from "@/lib/assignments/schedule";

type Props = { value: string };

export default function LocalizedTimestamp({ value }: Props) {
  const detected = useViewerTimeZone();
  if (!Number.isFinite(Date.parse(value))) return <span>Date unavailable</span>;
  const zone = detected && detected !== "unavailable" ? detected : "UTC";
  const label = formatZonedTimestamp(value, zone);
  const utc = formatUtcTimestamp(value);
  return <time dateTime={value} title={`Exact UTC: ${new Date(value).toISOString()}`}
    aria-label={zone === "UTC" ? label : `${label}. ${utc}`}>{label}</time>;
}
