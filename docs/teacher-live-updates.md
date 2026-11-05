# Teacher live updates

## Design and cost

- One **private Supabase Broadcast channel per class per visible browser tab**,
  shared by the roster, lesson progress, overview, and expanded histories. Hidden
  and offline tabs release their subscriptions and rejoin/catch up on return.
- Database triggers publish only `{ kind, assignmentId }` invalidation hints,
  never student names/IDs, account details, answers, or grades. Each subsequent
  read authenticates the teacher and checks ownership on the server.
- Notifications are coalesced for 250 ms and reads are limited to one per resource
  every five seconds. Changes received during a read trigger a follow-up read.
- Hints are also coalesced **in the database per transaction/class/resource/
  assignment**: approving 100 students in one statement sends one roster hint,
  not 100. Client-side debounce alone would not reduce billable messages.
- The server-rendered snapshot is reused on mount. Subscription/reconnection
  triggers a catch-up read to close the SSR/subscription gap.
- A five-minute fallback covers unavailable Realtime and missed events. Failed
  reads back off to 10, then 15 minutes, retaining last-loaded data. Notifications
  and focus events respect this backoff. Hidden/offline tabs make no data reads.
- Unchanged responses do not update React state. Classroom refresh buttons remain
  available but no longer also refresh the entire page on focus.
- Roster and lesson progress share **one background request and one server Auth
  verification**, rather than independent requests. The initial server page still
  uses its existing readers and request-scoped Auth cache; one combined catch-up
  read establishes an atomic revision baseline for subsequent updates. Explicit
  page refreshes and existing Server Action revalidation can still load a full
  server-rendered page; this optimization targets background updates.
- Idle classroom views make **one fallback HTTP read per five minutes** (12/hour),
  versus 24/minute (1,440/hour) with the original five-second polling. Initial
  catch-up, actual changes, focus, and expanded histories add reads. This is a
  request-budget comparison, not a production latency/throughput benchmark.
- Subsequent reads send an opaque revision cursor and return **only changed
  students** for roster/progress or the selected attempt overview. No-change
  reads return just a small version envelope, not a full class report. Missing
  notifications are recovered from the private revision index; deletions and
  class transfers use tombstones. Assignment/catalog changes or invalid future
  cursors require a full replacement snapshot. Timing is unchanged: no new
  toggle or 15-second refresh interval is introduced.
- The class dashboard (roster and each activity card's stage counts) and each
  activity's student progress page read from the same combined `updates`
  endpoint. Activity pages render a lightweight overview: counts, grades and
  stages without history JSON. Histories load for one student only while
  expanded, and stop fetching on collapse.
- Every report applies the shared assignment state from
  `20261104000200_shared_assignment_progress_state.sql`. The full and live
  reports share one private row builder per view, so stages, completion and
  grades cannot drift between the page load and later live updates.
- Two explicit GET endpoints (`updates`, `attempt-history`) own their
  authentication and mutable cookie refresh. The proxy skips its duplicate checks
  only for those endpoints; pages/actions retain the existing proxy guards.

## Free-plan budget

Checked against Supabase's currently published limits (verify again before rollout):

- [Realtime messages](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages):
  2 million per billing cycle on Free. Broadcast counts one sent message plus one
  for each receiving client. Tiny payloads still count as messages. Database
  triggers publish even when no teacher is listening, so idle delivery savings
  do not eliminate the sender count.
- [Realtime limits](https://supabase.com/docs/guides/realtime/limits): 200 concurrent
  connections and 100 messages/second on Free. This feature subscribes teacher
  tabs only, not every student. Bulk-operation deduplication reduces bursts, but
  simultaneous independent transactions can still hit the rate limit.
- [Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress): 5 GB
  uncached per billing cycle, shared across Database, Auth, Realtime and other
  services. Cached Storage egress is a separate allowance; it does not pay for
  these authenticated reads. API requests are not themselves Realtime messages,
  but their responses and repeated Auth checks consume compute and egress.

**Illustrative message budget, not a measured workload:** 300 students × 20
assignments/month × 10 emitted hints/assignment × (one sender + one teacher
recipient) = 120,000 messages, about 6% of the Free message quota. Extra teacher
windows, retries, more assignments and other project features add usage.

**Illustrative idle response budget:** 10 visible teacher tabs × 4 hours/day ×
20 days × 12 combined checks/hour × an assumed 1 KB unchanged response = about
9.6 MB/month. This is not a total Supabase egress estimate: Auth responses,
protocol overhead, initial snapshots, changed-student payloads and expanded
histories are additional. Measure these for your actual classes. Large reports
can make egress the tighter limit even when message usage is low.

Incremental tracking adds a compact private row per class/student and a class
counter update per writing transaction; a student's repeated changes update the
same index row. It trades some write work/storage for much smaller repeated
reads and egress. Deletion tombstones remain until a class-wide reset prunes old
entries, and class deletion cascades the tracking data. This is not a free or
zero-overhead cache: monitor database size, write load and class-row contention.

These safeguards reduce usage; they cannot guarantee the organization stays
within quota. Monitor **Organization → Usage** for Realtime messages, peak
connections, database size, and egress after a small-class rollout. The quotas
are shared with other usage/projects as described in Supabase's billing docs.
Free-plan overages can lead to service restrictions, not unlimited free usage.
Normal live delivery remains quick; if Realtime fails, the budget-conscious
fallback can leave data up to five minutes old (longer after repeated read
failures). Manual refresh is still available.

## Database changes and deployment

**These migrations are prepared in source control, not automatically applied to a
shared project. Confirm the target project and audit its deployed schema first.**
No additional environment variables or service-role browser keys are needed.
They require `20261104000200_shared_assignment_progress_state.sql` (from `dev`)
to be applied first, and are numbered to run after it.

1. `supabase/migrations/20261105000000_teacher_class_broadcasts.sql`
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
2. `supabase/migrations/20261105010000_teacher_live_attempt_summary.sql`
   - Adds `private.teacher_attempt_rows`, built on `assignment_progress_state`,
     and the service-role-only `teacher_activity_live_summary` RPC. The live RPC
     independently checks active class ownership, assignment membership, archive
     state, and optional student membership.
   - The default omits attempt-history JSON. Expanded histories explicitly request
     one student's rows. `teacher_activity_attempt_summary` is redefined to call
     the same helper with histories; its output and checks are unchanged.

3. `supabase/migrations/20261105020000_budget_teacher_notifications.sql`
   - Replaces the trigger function with transaction-local hint deduplication.
     Bulk approvals and related progress/attempt writes in one transaction share
     one hint per scope. The state resets at commit and rolls back with a
     savepoint, so later changes are not accidentally suppressed.
   - No table RLS or authorization policies are changed.

4. `supabase/migrations/20261105030000_teacher_student_revisions.sql`
   - Adds two RLS-protected, non-browser-accessible private tracking tables, a
     revision index, and one additional catalog-update trigger. Existing trigger
     paths record latest changed student IDs, retaining deletion tombstones.
   - A per-class counter row lock orders committed revisions; transaction-local
     caches avoid repeated counter/journal writes for the same scope. Full resets
     prune older tracking entries. Broadcast content and authorization are unchanged.
5. `supabase/migrations/20261105040000_teacher_incremental_reads.sql`
   - Adds the service-role-only `teacher_class_updates` RPC and the private
     lesson-row helper. One MVCC snapshot covers revision, membership and data;
     the RPC independently checks active class ownership and assignment access.
   - `teacher_class_lesson_progress` is redefined to call the same lesson-row
     helper; its output and ownership check are unchanged.

Apply all five approved migrations **before** deploying the new frontend. The
`updates` endpoint requires the new revision tables/RPC; fallback polling is not
a substitute for those migrations. Realtime itself may be unavailable and data
will still recover through the same combined delta endpoint on fallback.

These files were renumbered from earlier `20261027…` drafts so they run after
`dev`'s progress-state migration. A database that already applied the drafts
must not re-run them as-is (the tables, triggers and policies already exist);
reconcile its migration history first.

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
counts/grades/history ordering, combined/delta/idle reads, missed notifications,
agreement between live and full reports (including split Bohr quiz keys),
transfers/deletions, assignment/catalog resets, and RPC grants. It is not a certified application
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
