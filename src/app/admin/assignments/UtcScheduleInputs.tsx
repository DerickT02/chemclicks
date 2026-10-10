"use client";

/** Bounds for `<input type="datetime-local">` (UTC values entered as wall time). */
export const UTC_DATETIME_LOCAL_MIN = "2000-01-01T00:00";
export const UTC_DATETIME_LOCAL_MAX = "2099-12-31T23:59";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-foreground";

const clearButtonClass =
  "text-xs font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Props = {
  opensAt: string;
  closesAt: string;
  onOpensAtChange: (value: string) => void;
  onClosesAtChange: (value: string) => void;
  opensName?: string;
  closesName?: string;
};

export function isoToUtcDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString().slice(0, 16);
}

export default function UtcScheduleInputs({
  opensAt,
  closesAt,
  onOpensAtChange,
  onClosesAtChange,
  opensName = "opens_at",
  closesName = "closes_at",
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1 text-sm">
        <label className="block space-y-1" htmlFor={`${opensName}-input`}>
          <span>Opens at — optional</span>
          <input
            id={`${opensName}-input`}
            type="datetime-local"
            name={opensName}
            min={UTC_DATETIME_LOCAL_MIN}
            max={UTC_DATETIME_LOCAL_MAX}
            step="60"
            value={opensAt}
            onChange={(event) => onOpensAtChange(event.target.value)}
            className={inputClass}
          />
        </label>
        <button
          type="button"
          className={clearButtonClass}
          onClick={() => onOpensAtChange("")}
        >
          Clear opening time
        </button>
      </div>

      <div className="space-y-1 text-sm">
        <label className="block space-y-1" htmlFor={`${closesName}-input`}>
          <span>Closes at — optional</span>
          <input
            id={`${closesName}-input`}
            type="datetime-local"
            name={closesName}
            min={UTC_DATETIME_LOCAL_MIN}
            max={UTC_DATETIME_LOCAL_MAX}
            step="60"
            value={closesAt}
            onChange={(event) => onClosesAtChange(event.target.value)}
            className={inputClass}
          />
        </label>
        <button
          type="button"
          className={clearButtonClass}
          onClick={() => onClosesAtChange("")}
        >
          Clear closing time
        </button>
      </div>
    </div>
  );
}
