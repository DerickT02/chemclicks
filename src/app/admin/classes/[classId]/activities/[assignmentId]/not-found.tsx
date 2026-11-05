import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Activity not found</h1>
      <p className="mt-3 text-muted-foreground">This activity is not assigned to this class.</p>
      <Link href="/admin" className="mt-5 inline-flex rounded-md border border-border px-4 py-2">Back to classrooms</Link>
    </main>
  )
}
