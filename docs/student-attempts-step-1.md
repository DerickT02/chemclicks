# Student attempts: Step 1 (SCRUM-167)

## Applied to Chemclicks

The `student_attempts_schema` migration was applied through the Supabase connector to project `cprrlddivmtrlkubluyt`. The pre-existing attempts table was empty. Its `score` and `passed` columns were preserved; status, audit timestamps, constraints, a timestamp lookup index, and an update trigger were added. RLS remains enabled with no policies until Step 2.

The local migration matches the applied SQL and supports either the inspected legacy schema or an absent table. It is intentionally not rerunnable after successful application. For any other database, run `database/queries/student_attempts_inspect.sql` first and reconcile differences before applying.

Database verification passed in a transaction that was rolled back: defaults, retrieval, multiple attempts, duplicate numbers, foreign keys, positive numbers, status/completion consistency, timestamp ordering, update trigger, and cascading deletion. Metadata was inspected after applying. No verification fixtures were retained.

Both `.env.local` and `.env.test.local` currently target this same project. The standalone Vitest suites have not been run against it; use a dedicated test project for those persistent fixture tests.

Security advisors also reported pre-existing RLS-disabled `classes` and `teachers` tables. These were not changed as part of Step 1; review them before completing Step 2 authorization work.

## Attempt contract

An attempt row represents a started attempt. It starts as `in_progress` with a start timestamp; completion sets both `status = 'completed'` and `completed_at`. No attempts means no rows. Attempt numbers are positive and unique per progress record. Step 3 must allocate numbers safely and resume attempts without inserting duplicates. Step 2 must prevent unauthorized writes to history. The timestamp trigger maintains `updated_at`; it is not an authorization mechanism.

## Verify

Configure `.env.test.local` with the dedicated test project's values (never commit real credentials):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=<test-project-url>
SUPABASE_SERVICE_ROLE_KEY=<test-project-service-role-key>
```

Both schema suites write and delete fixtures. They require at least one existing teacher and activity as foreign-key anchors. They create their own classes, students, assignments, progress, and attempts; cleanup deletes their fixture classes and relies on the existing cascade relationships. Do not run against production.

```sh
npm run test -- tests/database/schema/student_attempts.test.ts tests/database/schema/student_progress.test.ts
npm run lint
npx tsc --noEmit
```

The service-role client bypasses RLS. Passing these tests proves schema behavior, not access-policy correctness. Step 2 adds authorization coverage using the appropriate identities.

Step 1 is complete when the migration is applied/reconciled, metadata inspection matches the contract, both schema suites pass, and lint/type checks pass. The migration and transactional database verification have been executed; the standalone Vitest suites still require a dedicated test environment.
