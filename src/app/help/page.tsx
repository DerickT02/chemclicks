import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Classroom Help & Student Data | ChemClicks" };

export default function HelpPage() {
  return (
    <main className="min-h-screen-below-nav bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-3xl space-y-8">
        <h1 className="text-3xl font-semibold">Classroom help</h1>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">For students</h2>
          <p>Choose <Link href="/create-account/student" className="underline">Join a class</Link>, enter your name, the Student ID your teacher provides, and your classroom code. Then <Link href="/login/student" className="underline">sign in as a student</Link> using that ID and code.</p>
          <p>Open My assignments, choose an activity, and select Start exploration before working. Select Finish exploration after the exercise to save your participation. Completion does not mean you passed a quiz.</p>
          <p>Practice labs are not saved for your teacher. Scores from assigned quizzes you finish are saved, and your teacher can see them. Closed assignments accept no further submissions, but your saved exploration history remains available while your classroom is active.</p>
          <p>If your classroom is unavailable or your ID/code does not work, ask your teacher. Sign out when finished on a shared device.</p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">For teachers</h2>
          <p><Link href="/create-account/teacher" className="underline">Create a teacher account</Link>, verify your email, and <Link href="/login/teacher" className="underline">sign in</Link>. Create a class and share its code and Student ID instructions with students.</p>
          <p>Assign an available activity and enter optional opening/closing times in your device&apos;s local time. Use Edit dates to extend a deadline. Refresh your classroom to see current lesson progress. Scores from finished assigned quizzes appear under Activity attempts.</p>
          <p>Disabling a class blocks student access but keeps its data. There is currently no reactivation control. For account or data requests, contact the person operating your ChemClicks site.</p>
        </section>
        <section id="student-data" className="space-y-3">
          <h2 className="text-xl font-semibold">What information is stored</h2>
          <p>ChemClicks stores student names, Student IDs, classroom membership, current exploration progress, saved attempt start/completion times, and assigned quiz attempts with their scores and pass results. Teachers can view their class rosters, exploration participation, and quiz scores.</p>
          <p>Teacher accounts use an email address, display name, and Supabase-managed password authentication. Classroom names, codes, schedules, and assignments are also stored. Supabase provides the database and authentication services.</p>
          <p>Disabling a class does not erase these records. Students should ask their teacher about correction or removal; teachers should contact the site operator. There is no self-service data-deletion control.</p>
          <p>This describes the current application, not a school-approved retention policy. Before using real student data, the teacher and site operator should agree on appropriate identifiers, access, retention, and removal arrangements.</p>
        </section>
      </div>
    </main>
  );
}
