-- Student login and every protected student request now require
-- students.verified = true. Before that gate, signup always stored false and
-- login ignored it, so almost every existing student row is still false and
-- those students would be locked out until a teacher approved each one.
--
-- Students who have already signed in (auth_user_id is set on first login)
-- were admitted under the old rules, so approve them here. Rows that never
-- signed in stay pending for their teacher to review.
--
-- Apply right before deploying the app version that enforces approval. A
-- student who signs in between this migration and that deploy is also
-- approved, which matches the behavior they had before the gate.
-- Safe to re-run; it only changes rows that are not yet approved.

begin;

update public.students
set verified = true
where auth_user_id is not null
  and verified is not true;

commit;
