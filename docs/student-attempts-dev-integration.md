# Attempt tracking integration with dev

This note supersedes the session, supported-activity and build limitations in the
step-by-step implementation notes recorded before the dev merge.

## Preserved dev behavior

- Student login, session lookup and logout use Supabase Auth. The custom signed
  student cookie and STUDENT_SESSION_SECRET are no longer used.
- Student assignment lists, scheduling/access wrappers, activity components,
  ionic/covalent lessons and quiz links are retained from dev.
- Teacher catalog, assignment scheduling and duplicate-class messages remain.
- Dependency versions and testing tools follow dev, with server-only retained as
  an explicit dependency.

Attempt controls and history are additive to the existing assignment page.
They support the same six exploration types as dev's hasActivityContent helper.
Exploration completion remains separate from quiz grading. Reading a page does
not create an attempt.

Existing revocations on database writes are still in place. To preserve those
restrictions without breaking dev's forms, signup writes use a server action,
and teacher class/assignment writes use the shared admin client after teacher
and ownership checks. Class and teacher RLS settings are not changed. Signup
still creates an unverified row; dev's Supabase login does not use that legacy
flag as a condition for student access.

## Required database compatibility migration

`supabase/migrations/20260928045044_align_attempts_with_student_auth.sql` updates
the existing service-only attempt RPCs to match dev's student enrollment rules
and supported activity types. It does not grant browser roles access to the RPCs
or alter table grants or RLS. It requires the previous attempt schema/RPC
migrations to have been applied.

**Pending approval / not applied:** automatic approval review rejected the live
migration because it removes the legacy students.verified condition and permits
three additional exploration types. Explicit approval has been requested. Until
it is applied, live attempts still enforce the older verified flag and three
activity types. Local code tests do not certify that pending database change.

## Validation

- 380 local tests passed across auth, assignments, routes, measurement, quizzes,
  chemistry, Bohr models and shared UI.
- TypeScript and the production build passed with dev's dependencies.
- The dev teacher-signup tests needed their missing display-name import/arguments
  and valid password fixtures corrected to match the existing validator. No
  teacher validation behavior was changed.
- The deleted cookie-session tests are replaced by dev's Supabase session tests.

```sh
npx vitest run tests/auth tests/assignments tests/routes tests/measurement tests/quiz tests/chemistry tests/bohr tests/ui
npx tsc --noEmit
npm run lint
npm run build
```

After approval and application of the compatibility migration, rerun the live
lifecycle/report test and the transactional SQL suites. The access SQL assertion
now reflects dev's enrollment contract rather than requiring legacy verification.
Manual browser acceptance of the merged flow remains pending.
