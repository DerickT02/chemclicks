'use client'

export default function AssignmentError({ reset }: { reset: () => void }) {
  return <div className="space-y-4 px-6 py-10">
    <p role="alert">Your assignment could not be loaded. Check that you are signed in and try again.</p>
    <button onClick={reset} className="rounded-lg bg-accent px-4 py-2 text-accent-foreground">Try again</button>
  </div>
}
