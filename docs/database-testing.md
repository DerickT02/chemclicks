# Database tests: destructive, opt-in only

`npm test` and `npm run test:watch` run every suite under `tests/` except `tests/database/`.
They do not load application `.env` files, overwrite the three Supabase credential
variables with inert values, and block unmocked `fetch`. DOM suites opt into jsdom
with `// @vitest-environment jsdom`; server-rendering suites stay in Node. This is
an accident-prevention boundary, not a general-purpose network/process sandbox.
Mock every external client/request in new unit tests.

All of `tests/database/` is excluded, **including `schema/`**. Several schema tests
create/delete real records. SQL-source-only checks in that directory are also
excluded for now. There is no configured browser/E2E runner.

## Before running database tests

Obtain explicit approval for the exact disposable Supabase project and the
fixture writes/Auth operations. These suites create and delete users, classes,
students, assignments, and progress/attempt rows; some use fixed fixture names
or existing teacher/activity anchors. Cleanup can cascade and is not guaranteed
if a test crashes. Never use a classroom, shared development, or production
project. Local Supabase instances must also be separate from application data.

Review the schema, Auth provisioning, grants, policies, RPC versions, and fixture
anchors first. This runner neither creates a project nor applies migrations or
seeds. Historical suites may assume an older contract; passing the guard is not
proof that the deployed schema is compatible or that fixtures are isolated.

## Dedicated fixture environment

Create an ignored `.env.database-test.local` at the repository root, or export
these three variables in the shell:

```dotenv
TEST_SUPABASE_URL=https://<disposable-project-ref>.supabase.co
TEST_SUPABASE_ANON_KEY=<test-project-anon-or-publishable-key>
TEST_SUPABASE_SERVICE_ROLE_KEY=<test-project-service-role-or-secret-key>
```

For an isolated loopback instance, use its URL. The runner rejects the same
loopback port as a configured application project, including
localhost/127.0.0.1/IPv6 aliases. Shell values override the dedicated file. Do not commit this file or keys.
Application credential names are never used as fixture fallbacks.

The runner rejects known application targets from exported variables and
`.env`, `.env.local`, `.env.development[.local]`, `.env.production[.local]`, and
`.env.test[.local]`. Application files are read only to build that target
denylist, not to supply fixture credentials. The keys, project purpose,
permissions, and remote state are not verified. Operators must confirm those
facts and obtain approval independently. Unknown production targets cannot be
detected from local configuration alone.

## Explicit invocation, after approval

The acknowledgement must be exported by the shell, **not put in an env file**:

```sh
CHEMCLICKS_ALLOW_DATABASE_WRITES=disposable-test-project \
  npm run test:database -- tests/database/integration/<approved-suite>.test.ts
```

Omitting the acknowledgement, fixture variables, or a safe target fails during
configuration, before database test modules are imported. Without a filename,
the opted-in command selects all database suites; prefer explicit approved
files. Files run serially to reduce cross-suite fixture collisions. This does
not repair isolation within existing suites or make their cleanup safe on
non-disposable data.

No database suites or live Supabase operations were run while implementing this
separation. CI runs only unit/component tests, TypeScript, and lint; it has no
Supabase secrets, fixture opt-in, database job, migration step, or deployment.
Do not bypass these configs or treat the acknowledgement as mutation approval.
