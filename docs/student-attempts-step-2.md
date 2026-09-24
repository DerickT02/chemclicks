# Step 2: attempt access controls (SCRUM-175)

## Implemented and applied

Migration `student_attempts_access` is applied to Chemclicks (`cprrlddivmtrlkubluyt`). The local SQL is in `src/lib/supabase/migration/20260924053830_student_attempts_access.sql`.

- RLS remains **disabled** on `classes` and `teachers`, as requested. Existing reads remain available. Client mutation privileges are revoked; class creation/deletion now use server authorization and service credentials. Teacher profile creation/approval remains an administrator operation; no self-approval endpoint was added.
- `student_attempts` has RLS enabled with teacher SELECT access. Its private helper verifies Supabase Auth identity, confirmed email, approved teacher membership, class ownership, and consistent student/class assignment. The helper returns only a boolean, uses a fixed search path, and is not in the exposed public API schema.
- Browser roles cannot insert, update, delete, or truncate attempts or rewrite the ownership chain. Mutation privileges on students, progress, assignments, and activities were also revoked to prevent history alteration/cascade bypasses. Future editors for those tables must use authorized server paths.
- Students use the existing signed application cookie, not a Supabase Auth JWT. `readStudentAttempts` and `createStudentAttempt` are server-only helpers. They derive identity from that cookie and call a service-role-only, SECURITY INVOKER database function. The function checks approved enrollment, active class, and exact progress/assignment scope. Student identity cannot be passed from the browser. Signed payload types, expiration and token structure are validated.
- Student login now performs the lookup server-side and requires `verified = true`, matching the attempt access requirement. This permits lookup through the existing no-policy students table without exposing the roster anonymously.
- Attempt creation assigns timestamps and numbering in the database and locks the progress row to serialize number allocation. No student update/delete/history-edit endpoint exists. Step 3 still needs activity start/resume/completion wiring and server-managed completion rules; calling create explicitly creates a new attempt.
- `server-only` guards prevent service-role code entering browser bundles. `SUPABASE_SERVICE_ROLE_KEY` must be configured in the application server environment, alongside `STUDENT_SESSION_SECRET` and the existing public URL/key. Never expose it as NEXT_PUBLIC.

## Verification

`tests/database/integration/student_attempts_access.sql` is an automated SQL assertion suite. It was run against the actual database with authenticated, anon and service_role roles. It creates temporary fixtures in a transaction and rolls them back, including test Auth users. No existing records are edited. It requires one existing activity as a fixture anchor.

Run the entire SQL file in Supabase SQL Editor (as postgres), or:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/database/integration/student_attempts_access.sql
```

Coverage: student-own create/read, student-other rejection, wrong class, inconsistent progress assignment, unverified student, inactive class, teacher-own/other reads, unrelated/anonymous reads, browser RPC denial, ownership takeover, parent deletion, direct attempt writes, mutation grants including TRUNCATE, and unchanged RLS state on classes/teachers.

Local verification:

```sh
npm run test -- tests/auth/student-attempt-access.test.ts tests/auth/student-session.test.ts tests/auth/teacher-server-access.test.ts tests/auth/class-server-writes.test.ts tests/auth/teacher-access.test.ts
npm run lint
npx tsc --noEmit
```

The broader auth/route suite has an existing teacher-email-verification test expecting `/teacher/dashboard`, while the helper returns `/admin`. TypeScript also has existing missing generated route references and an undefined `User` type in `src/proxy.ts`. These are outside this change.

Supabase security advisors still flag the intentionally disabled classes/teachers RLS and pre-existing unrelated settings/functions. No new advisor warning was reported for the attempt policy or helper functions. Student progress/roster policies and UI reporting remain separate work; this step does not expose those tables through new policies.

## Deployment

The database migration has already run. Deploy the accompanying application changes before using class mutations, since older application code attempts direct authenticated writes that are now denied. Do not rerun the migration manually. No application deployment, Git commit, push, or Jira status change was performed.
