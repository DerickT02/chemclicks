# Step 6: student activity attempt acceptance checks

The teacher report is available from **Classrooms → Activity attempts** at
`/admin/classes/[classId]/attempts`. Select an assigned activity and choose **View
attempts**. Expand a student's history to see attempt numbers, status, start time,
and completion time. Dates are labeled UTC; unfinished attempts say **Not
completed**. Students with no attempts remain visible with an explicit zero.

## Automated coverage

- The live lifecycle integration test now checks the teacher report before start,
  after concurrent starts, after concurrent completion, after concurrent retries,
  and after completing the retry. It verifies totals of zero, one, and two,
  exact attempt IDs, preserved timestamps, status counts, and another enrolled
  student who remains at zero throughout. Forged teacher/class/assignment scopes
  must return permission errors with no report data.
- The SQL access suite checks student and teacher ownership, anonymous and
  unrelated users, forbidden browser writes, and the intended RLS state.
- The SQL lifecycle suite covers replay/stale requests, progress synchronization,
  assignment schedules and invalid actions.
- The SQL reporting suite covers students without progress, progress without
  attempts, same-activity/different-class isolation, other assignments, malformed
  cross-class progress, empty rosters, and a 1,001-student roster.
- Server-boundary and rendered-route tests cover verified teacher sessions,
  activity selection, foreign selections, errors instead of false empty results,
  zero counts, timestamps, loading announcements and retry controls.

Run the local checks (no database fixture writes):

```sh
npx vitest run tests/auth/student-attempt-lifecycle.test.ts tests/auth/student-attempt-access.test.ts tests/auth/student-session.test.ts tests/auth/teacher-attempt-summary.test.ts tests/auth/teacher-activities.test.ts tests/auth/teacher-server-access.test.ts tests/auth/class-server-writes.test.ts tests/routes tests/measurement
npm run lint
npx tsc --noEmit
```

Run the live test against the intended project configured in `.env.test.local`:

```sh
npx vitest run tests/database/integration/student_attempt_lifecycle.test.ts
```

It requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, an existing
teacher and the Lewis diagram activity. It creates its own disposable class,
students and assignment, then deletes only that class and its dependent rows.
It does not edit the existing teacher or activity. Do not run the entire database
suite indiscriminately; other legacy tests also write fixtures.

Run these SQL files in Supabase SQL Editor as postgres, or using psql with
`ON_ERROR_STOP=1`. Each rolls back its fixtures:

- `tests/database/integration/student_attempts_access.sql`
- `tests/database/integration/student_attempt_lifecycle.sql`
- `tests/database/integration/teacher_activity_attempt_summary.sql`

## Manual browser acceptance

1. Sign in as a teacher with an assigned supported activity and two enrolled
   students. Open the activity report and confirm both students start at zero.
2. In a separate browser session, sign in as one verified student. Open the
   assignment, start, and refresh. Refresh the teacher report: exactly one
   in-progress attempt should appear; the untouched student stays at zero.
3. Finish the exploration. Refresh the report and confirm the same attempt is
   completed, with its original start time and a completion time.
4. Choose Try again as the student, refresh, and finish. The teacher report should
   show exactly two completed attempts and preserve attempt 1's timestamps.
5. Change activity and class selections. No attempts from the previous selection
   should appear. Check an empty class and an unassigned class separately.
6. Open the report as another teacher or without a teacher session. No student
   report should be returned. A failed request should show an error, not zeros.
7. At a narrow viewport, check the activity selector and expand history. The
   history table can scroll horizontally. Check keyboard access to selection,
   View attempts, history disclosure and retry controls.

The automated live check covers RPC integration, not browser interaction. The
manual teacher browser checklist above has not been executed in Step 6.

## Results (2026-09-24)

- 52 targeted local tests passed.
- The extended live lifecycle/report test passed, including fixture cleanup.
- All three transactional SQL assertion suites passed.
- Lint passed with two existing warnings.

## Verification limits and configuration

No new migration or RLS change is required for this step. RLS remains disabled
on classes and teachers as requested. Service credentials stay on the server;
teacher verification and class ownership checks protect the report path.

Lint passes with the existing unused `KeyboardEvent` and `getUserRole` warnings.
TypeScript remains blocked by the pre-existing undefined `User` type in
`src/proxy.ts:10`; this prevents claiming full build readiness. The legacy
teacher-email-verification test also expects an obsolete `/teacher/dashboard`
redirect rather than `/admin` and is outside the targeted suite above.

Completion records exploration participation, not quiz grading. Supported
tracked activities and required enrollment settings are documented in Step 3.
