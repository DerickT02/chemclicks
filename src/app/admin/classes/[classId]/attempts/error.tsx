'use client'
import Link from 'next/link'

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Unable to load activity attempts</h1>
      <p role="alert" className="mt-3 text-muted-foreground">The report is unavailable or you do not have access. Check that you are signed in with the correct teacher account and try again.</p>
      <div className="mt-5 flex gap-4">
        <button onClick={reset} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">Try again</button>
        <Link href="/admin" className="rounded-md border border-border px-4 py-2">Back to classrooms</Link>
      </div>
    </main>
  )
}
