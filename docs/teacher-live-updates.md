# Teacher live updates

## Design and cost

- One **private Supabase Broadcast channel per class per browser tab**, shared by
  the roster, lesson progress, overview, and expanded histories.
- Database triggers publish only `{ kind, assignmentId }` invalidation hints,
  never student names/IDs, account details, answers, or grades. Each subsequent
  read authenticates the teacher and checks ownership on the server.
- Notifications are coalesced for 250 ms and reads are limited to one per resource
  every two seconds. Changes received during a read trigger a follow-up read.
- The server-rendered snapshot is reused on mount. Subscription/reconnection
  triggers a catch-up read to close the SSR/subscription gap.
- A one-minute fallback covers unavailable Realtime and missed events. Failed
  reads back off to 2, 4, then 5 minutes, retaining last-loaded data. Notifications
  and focus events respect this backoff. Hidden/offline tabs make no data reads.
- Unchanged responses do not update React state. Classroom refresh buttons remain
  available but no longer also refresh the entire page on focus.
- Idle classroom views make **two fallback HTTP reads/minute**, versus 24 with the
  original five-second polling. Initial subscription catch-up, actual changes,
  focus, and expanded histories add reads. This is a request-budget comparison,
  not a production latency/throughput benchmark.
- Attempt overview reads return counts/grades/stages but skip history JSON
  aggregation. Histories load for one student only while expanded, and stop
  fetching on collapse. The legacy full-history RPC is unchanged.
- Three explicit GET endpoints (`progress`, `roster`, `attempt-history`) own their
  authentication and mutable cookie refresh. The proxy skips its duplicate checks
  only for those endpoints; pages/actions retain the existing proxy guards.

## Database changes and deployment

**These migrations are prepared in source control, not automatically applied to a
shared project. Confirm the target project and audit its deployed schema first.**
No additional environment variables or service-role browser keys are needed.

1. `supabase/migrations/20261027000000_teacher_class_broadcasts.sql`
   - Adds six AFTER triggers on students, progress, attempts, measurement quiz
     sessions, assignments, and classes, plus narrowly scoped private functions.
   - Adds receive-only policies on `realtime.messages`. Only verified,
     non-anonymous teacher owners of active classes can receive their class's
     hints. Student-linked Auth users are denied even with legacy teacher rows.
   - Restrictive policies protect the reserved `teacher-class:` namespace even
     if an existing permissive policy is broad; client publishing is denied.
     Other topic namespaces are not intentionally changed. Audit existing
     policies/settings in the target project, including the Realtime public
     access setting. The migration does not change global Realtime settings.
   - It does not enable raw-table Postgres Changes or alter existing table RLS.
2. `supabase/migrations/20261027010000_teacher_live_attempt_summary.sql`
   - Adds the service-role-only `teacher_activity_live_summary` RPC, preserving
     existing grade/timer rules and independently checking active class ownership,
     assignment membership, archive state, and optional student membership.
   - The default omits attempt-history JSON. Expanded histories explicitly request
     one student's rows. The existing `teacher_activity_attempt_summary` remains
     compatible with older clients.

Apply the approved migrations **before** deploying the new frontend: the live
attempt overview and history endpoints require the new RPC. If only Broadcast is
unavailable, data reads still work through the fallback. If the RPC migration is
missing, the new attempts page cannot load; fallback is not a substitute for it.

Broadcast permissions are cached by Realtime until a JWT refresh/rejoin. A revoked
listener may briefly continue receiving non-sensitive invalidation hints, but
server reads always re-check access and never trust the hint as authorization.

## Validation

Safe mocked suites include channel sharing/cleanup, reconnect catch-up, debounce,
resource filtering, unchanged-data render suppression, request budgets, backoff,
request timeout/cleanup, approval submission preservation, lazy history reads,
server ownership checks and proxy allowlisting:

```sh
npm test
npm run lint
npm run typecheck
```

A local-only SQL fixture builds a minimal empty schema and **stubs**
`realtime.send` to record hints. It checks actual SQL execution, RLS (including
pre-existing broad policies), old/new class routing, no-op suppression, report
counts/grades/history ordering, and RPC grants. It is not a certified application
baseline or a hosted Realtime delivery test. It is excluded from `npm test`.

With local PostgreSQL binaries installed, run it in a disposable socket-only
cluster; this does not use `.env.local`, a Supabase project, or network credentials:

```sh
set -eu
scratch=$(mktemp -d /tmp/chemclicks-live-sql.XXXXXX)
cleanup() { pg_ctl -D "$scratch/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$scratch"; }
trap cleanup EXIT
initdb -D "$scratch/db" -U postgres -A trust --no-instructions >"$scratch/init.log"
pg_ctl -D "$scratch/db" -l "$scratch/server.log" \
  -o "-F -k $scratch -p 55439 -c listen_addresses=''" -w start
psql -X -h "$scratch" -p 55439 -U postgres -d postgres \
  -f tests/database/integration/local_teacher_live_updates.sql
```

Before production rollout, use the separately approved development project to
verify actual private-channel joins/denials, signup/approval/exploration/quiz
notifications, reconnect catch-up, fallback with Realtime blocked, and cookie
refresh after session expiry. Measure representative class sizes and histories
with database query plans and browser/server metrics. No production load test
has been performed by the mocked or local-stub checks.
