type Props = {
  name: "opens_at" | "closes_at"; value: string; readOnly?: boolean; onChange: (value: string) => void;
};

export default function ScheduleDateField({ name, value, readOnly, onChange }: Props) {
  const label = name === "opens_at" ? "Opens at" : "Closes at";
  return <label className="block space-y-1 text-sm"><span>{label} — optional</span>
    <input type="datetime-local" name={name} value={value} readOnly={readOnly}
      onChange={event => onChange(event.target.value)}
      className="min-w-0 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground" /></label>;
}
