"use client";

import { useSyncExternalStore } from "react";
import { formatUtcTimestamp } from "@/lib/assignments/schedule";

type Props = { value: string };

const noopSubscribe = () => () => {};
const hydrated = () => true;
const notHydrated = () => false;

export default function LocalizedTimestamp({ value }: Props) {
  // False on the server and during hydration, so the first render matches the server's UTC text.
  const isClient = useSyncExternalStore(noopSubscribe, hydrated, notHydrated);
  if (!Number.isFinite(Date.parse(value))) return <span>Date unavailable</span>;
  const utc = formatUtcTimestamp(value);
  const label = isClient
    ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })
    : utc;
  return <time dateTime={value} title={utc}>{label}</time>;
}
