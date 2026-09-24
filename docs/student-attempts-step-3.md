# Step 3: persisted exploration lifecycle

The `student_attempt_lifecycle` migration is applied to Chemclicks. RLS remains disabled on classes/teachers and enabled on attempts, as in Step 2.

## Behavior

- Student login redirects to `/student`, which lists the student's class assignments.
- `/student/assignments/[assignmentId]` shows a start button before any attempt exists. Merely visiting or refreshing never creates an attempt.
- Start creates the progress record if necessary and starts attempt 1. Refreshing, returning to the page, or replaying start reuses the current attempt, including an already-completed one.
- Finish exploration records a server timestamp and completes the same attempt. Replayed completion preserves original completion/update timestamps.
- Try again refers to the completed attempt it follows. Concurrent or stale retry requests do not create additional attempts. A partial unique index ensures at most one active attempt per progress record.
- Progress status and completion timestamps update in the same transaction as the attempt. A late completion request for an older attempt cannot overwrite newer progress.
- The database validates verified enrollment, active class, assignment open/close times, activity support, and exact attempt ownership. The service-only RPC cannot be called by browser roles. Scores/pass results are not accepted from clients.

## Supported activities and limits

Tracked exploration currently supports Lewis Dot Diagram, Ruler — Hundredths, and Graduated Cylinder using the existing components. Other activity types show an unavailable message and cannot start through the RPC. The public lab routes remain previews; class-specific tracking happens through assignments.

Completion means the student explicitly finished exploring. It does not mean a scored quiz was passed; score/passed remain null. Selected elements and measurement widget positions are local UI state and reset on refresh; attempt identity/history persist. Quiz responses and grading are separate work.

To use this with a real student, the database must have an approved student (`verified = true`), active class, and supported `class_activities` assignment. No sample assignments or verification accounts are retained by these tests.

## Verification

Executed successfully:

- `tests/database/integration/student_attempt_lifecycle.sql`: transactional database assertions for start/resume, duplicate completion/retry, stale requests, progress synchronization, cross-student/class access, schedules, and browser-role rejection. All fixtures roll back.
- Step 2's `student_attempts_access.sql` regression suite (fixture now selects the supported Lewis activity).
- Live Vitest concurrency test: six simultaneous starts create one attempt, three completions preserve one timestamp, six retries create only attempt 2, and stale completion leaves the retry in progress. Its disposable class is cleaned up afterward.
- Local server-boundary, availability, session and route tests.
- Browser check: student login → assignment → start → refresh → finish → retry → refresh → finish. History retained exactly two attempts. Disposable browser fixtures are cleaned up afterward.

Run the targeted local tests:

```sh
npm run test -- tests/auth/student-attempt-lifecycle.test.ts tests/auth/student-attempt-access.test.ts tests/auth/student-session.test.ts tests/routes
npm run lint
npx tsc --noEmit
```

Run the live concurrency test only against the intended test project configured in `.env.test.local` (it writes disposable fixtures):

```sh
npm run test -- tests/database/integration/student_attempt_lifecycle.test.ts
```

Run the SQL assertion files in Supabase SQL Editor as postgres, or with psql and `ON_ERROR_STOP=1`. The migration has already been applied; do not rerun it.

The existing undefined `User` type in `src/proxy.ts` still blocks full TypeScript validation. Lint has two existing warnings. This work does not deploy the application or commit/push Git changes. Deploy the application changes together with the server-only environment configuration from Step 2.
