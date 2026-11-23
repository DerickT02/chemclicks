type Props = {
  firstName: string;
  lastName: string;
  attemptCount: number;
};

export function AttemptHistorySummary({ firstName, lastName, attemptCount }: Props) {
  return (
    <summary className="inline-flex min-h-9 w-fit max-w-full cursor-pointer list-none items-center gap-1.5 rounded-md py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card [&::-webkit-details-marker]:hidden">
      <span>Attempt history ({attemptCount})<span className="sr-only"> for {firstName} {lastName}</span></span>
      <svg className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open/history:rotate-180" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </summary>
  );
}
