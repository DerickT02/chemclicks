export type AvailabilityWindow = {
  opens_at: string | null;
  closes_at: string | null;
};

/** Opening is inclusive; closing is exclusive. Invalid timestamps fail closed. */
export function isAssignmentAvailable(window: AvailabilityWindow, now: number): boolean {
  return Number.isFinite(now)
    && (window.opens_at === null || Date.parse(window.opens_at) <= now)
    && (window.closes_at === null || now < Date.parse(window.closes_at));
}
