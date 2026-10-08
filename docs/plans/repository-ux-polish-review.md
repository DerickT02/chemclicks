# ChemClicks repository review: student/teacher flow and UX polish

**Status:** Application implementation started at the user's request; DB/Auth changes still require separate explained approval.

**Baseline:** `3623f1f` (merged student activity attempts).

**Recommendation:** Repair the end-to-end classroom workflow before adding more features or redesigning the interface.

### Implementation progress — first application slice

Implemented:

- **P0-01:** Check the session helper's returned error; catch missing configuration/lookup/session exceptions at the login action boundary. Student and teacher auth forms restore pending state in `finally` and announce failures. Student login retains its intentional full-document navigation only after confirmed session creation.
- **P1-02:** Replace the missing combined Lewis quiz destination with covalent/ionic cards, reflecting open, scheduled, closed, unassigned, and failed-load states. Add an own-class, active-class-scoped schedule-metadata reader without exposing exercise content before opening. Replace the inert quiz continuation control with a real return link on both pass and fail screens; remove mandatory-progression copy.
- **P1-05, partial:** Explain unsaved/teacher-invisible results on Bohr/Lewis quiz pages, Lewis practice, and the shared multiple-choice result screen. No persistence, progression, passing-threshold, scoring, or retry-policy changes. Measurement messaging remains for a later slice.
- **P1-13, partial:** Remove nonfunctional teacher password recovery; add a student Join a class link; stop claiming administrator approval is required for teachers; retain passwords after unrelated local validation failures. Teacher provisioning itself is unchanged and remains a separate P0-02 investigation.
- **P2-06, partial:** Remove the unused proxy type import; document the deliberate student-login full reload with a narrow lint exception rather than changing session-navigation behavior.

Regression coverage includes the login action and auth forms, independent Lewis quiz availability/cards, schedule-reader ownership/active-class checks, and real result links with unchanged pass/fail scoring.

Validation for this slice:

```sh
npx vitest run tests/auth tests/assignments tests/routes tests/measurement tests/quiz tests/chemistry tests/bohr tests/ui
# 43 files / 416 tests passed (explicitly selected mocked/non-database suites)
npx tsc --noEmit --incremental false
# Passed
npm run lint
# Passed; no warnings
git diff --check
# Passed
```

No live Supabase queries, writes, Auth operations, migrations, database fixture tests, production build, or browser acceptance have been run for this slice. Default `npm test` still discovers database-writing suites; do not use it with existing project credentials until P2-06 test separation is implemented.

**Still pending:** Provisioning/role isolation and deployment investigation; real shared navigation; deliverable catalog filtering; confirmed class disabling; footer/marketing cleanup; safe default test separation; later Phase B/C work. Phase A's exit criteria are **not** met yet. Existing permanent-class-removal behavior is not changed by this slice. Each DB/Auth remediation or live mutation needs its own explanation and approval.

### Recorded review decisions

- **Ruler:** One tenths activity only; remove the separate hundredths experience from the application/catalog. Reporting precision is confirmed as 0.1 cm; choose compatible markings/tolerance during implementation. Existing records are testing data, so historical hundredths compatibility/preservation is not a product requirement. Any Supabase cleanup still needs a specific explained approval before execution.
- **Quiz results:** Eventually save results and make them visible to teachers, but do not implement persistence/reporting now.
- **Quiz progression:** Potentially teacher-configurable, but the policy is undecided. Do not implement gates or configuration now.
- **Thresholds/retries:** Do not change current passing thresholds, scoring, retry limits, or score-selection policy. Record these questions alongside persistence/progression for later review.
- **Teacher signup:** Teachers register freely; retain email verification and strict teacher/student role separation. No administrator approval workflow.
- **Student enrollment:** Target flow requires teacher approval after a student requests to join. Do not implement approval UI, approval mutations, or new approval enforcement yet; preserve current enrollment behavior during this testing/polish pass and do not claim approval is already enforced.
- **Class removal:** Disable/soft-delete only using the existing active/disabled flag (`is_active = false`); no permanent deletion endpoint or routine hard delete. Disabled-class listing/reactivation UI is deferred; do not implement it now.
- **Deadlines:** Block further assignment submissions at closing; no grace period or late-submission feature. Keep completed work/completion history available read-only to authorized students. New quiz-result saving remains deferred.
- **Practice labs:** Retain a separate clearly labeled untracked practice area.
- **Password recovery:** Deferred. Do not implement password-reset functionality in this scope; remove or hide the currently nonfunctional control.
- **Keyboard controls:** Completion of keyboard-control support is deferred. Preserve existing support; do not add new keyboard interactions in this scope. Other visual, semantic, and reduced-motion polish remains proposed, not implicitly approved.
- **Login methods remain separate:** Teachers use email/password at `/login/teacher`; students use Student ID/classroom code at `/login/student`. Role separation means enforcing different permissions after login, not merging these forms or credentials. Both can use Supabase-managed sessions internally without sharing access rights.
- These recorded decisions originally updated the proposal only. The user has since requested that application implementation begin (tracked above); Supabase writes and Auth/deployment changes remain subject to separate explained approval.

## 1. Executive summary

The interactive chemistry components are substantially further along than the product workflow around them. We have useful explorers, randomized quizzes, assignment scheduling, persisted exploration attempts, and teacher attempt history. The gaps are mainly between those pieces: navigation, onboarding, activity availability, completion semantics, and trustworthy reporting.

### Highest-value changes

1. Resolve the teacher/student identity and signup conflicts, and stop reporting successful student login when session creation fails.
2. Replace placeholder navigation and broken quiz links with real, role-appropriate destinations.
3. Only let teachers assign activities that students can actually complete; consolidate ruler work into one tenths activity.
4. Explicitly distinguish **assigned work**, **untracked practice**, **exploration completion**, and **quiz results**.
5. Replace class deletion with confirmed disabling via `is_active = false`; retain class data.
6. Make teacher progress percentages accurate and show load failures instead of misleading zeros.
7. Add assignment date editing, understandable local-time scheduling, and useful student status cards.
8. Make quiz completion actionable and preserve questions through background refreshes; explain that current quiz results are not saved. Persistence, progression, and grading-policy changes are deferred.
9. Improve scoped visual/accessibility polish and remove UI that promises functionality we do not have; new keyboard-control work is deferred.
10. Add browser workflow tests: passing component tests currently preserve some broken product behavior.

### Review boundaries

This is a repository-wide source review covering App Router routes/layouts, shared UI, authentication, server actions, data readers/writers, chemistry and measurement modules, migrations, tests, configuration, assets inventory, and existing documentation. Findings below cite implementation paths; proposed features are separated from observed defects.

- **Verified locally:** 40 test files / 380 tests passed using the explicitly selected non-database suites; TypeScript passed; lint passed with two warnings.
- **Not verified:** deployed database state, migration application, actual teacher/student browser journeys, visual appearance at different viewport sizes, assistive-technology behavior, or production build/deployment.
- No live Supabase queries, mutations, migrations, database fixture tests, or application-code edits were performed. Only this plan is being added.
- Existing notes in `docs/student-attempts-dev-integration.md` explicitly say the attempt compatibility migration was pending approval. Treat that as a deployment question, not proof of the current live state.

## 2. What should stay

Avoid throwing away working pieces in a broad redesign:

- The theme tokens and light/dark foundation in `src/app/globals.css`.
- The shared auth form components and accessible field error patterns.
- The Bohr, Lewis, ionic, and covalent explorers, including explanatory captions and chemistry caveats.
- Randomized quiz questions **and answer-choice shuffling**, which are already implemented.
- Measurement first-answer scoring, precision/tolerance explanations, retry feedback, and focus management.
- Explicit student/class scoping and server-only service credentials.
- Exploration attempt idempotency, concurrency handling, history, and teacher reports that include students with zero attempts.
- Server-enforced availability windows. UX changes must not weaken ownership or deadline checks.

## 3. Product decisions and deferred questions

The reviewed decisions below replace the original recommendations. Unresolved items are not implementation authorization.

| Topic | Reviewed direction | Current-scope consequence |
| --- | --- | --- |
| Practice labs | Keep separate, explicitly untracked. | `/student` remains My assignments; practice does not imply classroom credit. |
| Quiz results | Save and show to teachers later; implementation deferred. | State that current results are not saved; no new grade persistence/reporting. |
| Quiz-controlled progression | Teacher-configurable is a possible future direction; undecided and deferred. | No gates/settings now; replace inert actions and misleading mandatory-sequence copy only. |
| Passing thresholds/retries | Leave current behavior untouched; revisit with the two quiz topics above. | Do not reconcile the 70%/80% discrepancy or change retake/scoring policy in this pass. |
| Teacher signup | Freely available, with email verification. | Fix provisioning/role isolation; do not introduce administrator approval. |
| Student approval | Required in the target product, but implementation deferred. | Keep current enrollment behavior during testing; do not implement approval controls/enforcement or imply they exist. |
| Class removal | Disable via `is_active = false`, never permanently delete. | Replace hard-delete behavior and retain related rows; no disabled-class list or reactivation UI in this pass. |
| Deadlines | No further submissions after close; completed work/history remains read-only. | Separate read/review authorization from mutation availability. |
| Ruler | Tenths only; old records are disposable testing data. | Remove hundredths across UI/content/tests; Supabase cleanup still requires explicit approval. |
| Exploration completion | Still proposed: self-reported participation, not mastery. | Improve placement/save feedback; do not treat it as a quiz grade. |
| Retry status display | Still proposed: show prior completion alongside an active retry. | Display-only improvement; no change to current quiz scoring/retry policy. |
| Multi-class enrollment | Deferred unless required. | Keep/document the current single-class model. |

### Deferred assessment decisions — review together, not in this pass

1. **Saved results:** Which quizzes/results should be recorded, which details should teachers see, and should a student resume a partially completed quiz?
2. **Progression:** Can teachers enable passing gates per class or per assignment? What exactly unlocks, and can teachers override a gate?
3. **Thresholds/retries:** Resolve 70% versus 80%; decide fixed versus configurable thresholds, allowed retakes, and best versus latest score. Until reviewed, all existing grading/retry behavior stays unchanged.

Teacher approval of students is also deferred. Its future scope includes pending/rejected enrollment states, teacher approve/reject controls, authorized server mutations, and consistent enforcement in login, assignment reads, and attempt writes. None of those features are included in the current polish pass.

## 4. Target journeys

### New student

**Current testing/polish flow:** Home → choose Student → Join a class → enter name, Student ID, and classroom code → accurate confirmation with a student sign-in action → Student login → My assignments with student/class identity visible. Preserve current access behavior; do not imply a teacher already approved the request.

**Future flow, deferred:** Request to join → Awaiting teacher approval → teacher approves → student can access class work. Approval UI, writes, and enforcement are not being implemented now.

Avoid landing back on marketing after signup. Keep signup separate from authentication unless an automatic-login change is explicitly approved.

### Returning student

Student login → My assignments → select **Start / Resume / Review** → see learning goal and closing time → start an exploration attempt explicitly → explore → finish → see **Completion saved** and next action → optionally take a clearly identified quiz → return to assignments.

Practice labs should always say that practice does not record assignment completion. At closing, block further submissions, explain the closed state, and retain authorized read-only review of completed work/completion history. Do not add late submissions, a grace period, or new persisted quiz results.

### New teacher

Home → choose Teacher → freely create teacher account → verify email → Classrooms → Create your first class → selected new class → copy classroom code/join instructions → preview a supported activity → assign and confirm its schedule → see enrolled students. Teacher approval of student join requests is a later phase, not an existing capability.

### Returning teacher

Teacher login → previously selected classroom when possible → separate Assignments / Students / Reports areas → assign or edit dates → see Scheduled/Open/Closed status → inspect a selected activity's roster and exploration attempts → safely disable a finished class. Quiz-result reporting remains deferred.

No new `/teacher/dashboard` is necessary just to improve labels: `/admin` can remain the implementation route while the UI calls it **Classrooms** or **Teacher dashboard**.

## 5. Prioritized change list

**P0:** correctness/security or deployment blockers. **P1:** core classroom experience. **P2:** polish/maintainability.

**S / M / L:** relative scope, not time estimates.

**Approval:** “DB/Auth” means explain and obtain explicit approval before any Supabase mutation, migration, policy, grant, fixture write, or auth configuration change. This document is not that approval.

### P0-01 — Fix student login's false-success path [S; application]

**Evidence:** `src/app/login/student/actions.ts` awaits `createStudentSupabaseSession()` but ignores its result. `src/lib/auth/student-supabase-auth.ts` returns an error string on failure, including from its catch block; it does not normally throw. The action therefore returns `{ ok: true }` even when it did not establish a session.

**Change:** Handle the returned error and report a retryable login failure. Add a test at the login-action boundary, not just the helper. Wrap client submission in try/finally so an exception cannot leave **Signing in…** stuck. Apply the same reliable pending/error handling to teacher auth forms.

**Acceptance:** Failed token exchange, failed student/Auth linking, and missing configuration keep the student on login with an announced error. Only confirmed session creation navigates to `/student`; no success-message/redirect-back-to-login loop.

### P0-02 — Reconcile teacher provisioning with student Supabase Auth [L; DB/Auth approval]

**Evidence:** `src/lib/supabase/migration/20260920000100_teachers_signup_trigger.sql` creates a teacher for **every** new `auth.users` row. Its comments assume students do not use Supabase Auth; they now do. The newer migration `supabase/migrations/20260922191858_student_supabase_auth.sql` adds student Auth linking but does not revise that trigger. Teacher signup also calls `insertTeacher()` from the browser after Auth signup (`src/app/create-account/teacher/page.tsx`), potentially duplicating a trigger-created profile or failing under revoked browser write grants.

**Risk:** If the recorded trigger is deployed unchanged, student identity provisioning can also create teacher membership. Membership plus a confirmed email is used by teacher authorization. Separately, teacher registration can create an Auth account but display a profile error instead of its verification step. These are source-level conflicts; live trigger/grant state has not been checked.

**Change:** First inspect deployed triggers, grants, profiles, and provisioning behavior read-only. Design one teacher-provisioning path supporting free teacher registration and one explicit teacher/student role contract. Do not add administrator approval or let student identities self-promote through client-editable metadata. Reconcile accidental profiles only after identifying impacted records and receiving approval. Enforce teacher authorization at the actual `/admin` server boundary: `src/app/(teacher)/layout.tsx` does not wrap routes under `src/app/admin/`.

**Acceptance:** Student login cannot grant access to teacher pages or class mutations. A freely registering teacher creates exactly one intended profile and reaches email verification. Role/verification rules and recovery from partial signup are consistent across login, pages, proxy, and mutations; no student-approval feature is introduced.

### P0-03 — Confirm deployment compatibility and database privacy [M; DB/Auth approval]

**Evidence:** `docs/student-attempts-dev-integration.md` records `20260928045044_align_attempts_with_student_auth.sql` as pending approval. Historical RPCs require verified students and support fewer activity types than current UI. Earlier notes also record disabled RLS on classes/teachers; SQL files and docs are not evidence of their current deployed state.

**Change:** Prepare a read-only compatibility/security checklist, then request approval for any remediation. Verify RPC versions, supported types, current versus future student-approval rules, role isolation, and anonymous/unrelated-user table reads. Do not blindly apply the earlier compatibility migration: it removes the legacy verified-student check, while teacher approval is now a future requirement. Record any present UI/RPC mismatch and review a specific remediation separately without implementing the deferred approval system. Explain why server-side scoping alone does not protect direct database API access when grants/RLS permit it. Also approve the student credential threat model: a shared classroom code plus a known/guessable Student ID can let someone impersonate another student. Decide whether classroom aliases or individual secrets are required, and add rate limiting/abuse handling without silently replacing the intended passwordless classroom experience.

**Acceptance:** Every activity exposed as tracked works for a newly enrolled student; unrelated users cannot read rosters, teacher data, or classroom codes. No database deployment is bundled silently with cosmetic work.

### P1-01 — Replace fake navigation with a small, real sitemap [M; application]

**Evidence:** `src/components/Navbar.tsx` has student Home/Models and almost all teacher links pointing to `#`. The student logo also points to `#`. Those controls scroll instead of navigating. Role is inferred from pathname; authenticated people on public pages have Sign out but no dashboard shortcut. Desktop and mobile auth rendering are inconsistent on protected-path error states.

**Change:** Student navigation: **My assignments**, **Practice labs**. Teacher navigation: **Classrooms** and a genuine activity-preview destination if added. Public navigation: working Features/How it works plus role entry. Logo returns to the appropriate dashboard. Use active states for nested routes, real links, and a visible **Back to…** on lab/quiz pages. Resolve authenticated role without trusting pathname for identity.

**Acceptance:** Every visible navigation item reaches a real destination; students can always get home from a lab or quiz. Signed-in users on `/` can return to their dashboard. Mobile menu closes on navigation and communicates its expanded state.

### P1-02 — Repair quiz destinations and real next actions [S; application]

**Evidence:** `src/app/(student)/student/labs/lewis/page.tsx` links to `/student/quizzes/lewis`, but only Bohr, covalent, and ionic quiz routes exist. `QuizShell.tsx` renders **Continue to next section** without any handler/destination. Both Bohr and Lewis quiz headers say completion is required before moving on, but no progression gate is wired.

**Change:** Replace the old combined Lewis link with separate covalent/ionic quiz cards using their actual access state. Honor the practice/graded decision. Replace the inert completion button with **Back to assignments**, **Review lesson**, or a real next available activity. Do not introduce an arbitrary combined quiz merely to preserve an obsolete link.

**Acceptance:** No visible quiz link returns 404. Every result-screen button works. Locked, scheduled, closed, and unassigned quizzes have accurate explanations, not one blanket “your teacher must assign” message.

### P1-03 — Make the teacher catalog reflect deliverable activities [M; application; DB/Auth if tracking support expands]

**Evidence:** `listActivityCatalog()` in `src/lib/db/activities.ts` exposes all rows. `hasActivityContent()` excludes both Bohr activity types, even though `BohrModelViewer` works in Practice labs. Teacher catalog cards do not distinguish these unsupported assignments.

**Change:** Define a shared activity registry for title, description, explorer, practice location, quiz association, and tracked support. Immediately disable unsupported assignment choices with a clear reason. Avoid unrelated catalog/data removal; the reviewed exception is removing hundredths ruler work, whose existing records are disposable testing data (P1-04). Then wire distinct Bohr intro/stability assignment experiences if approved, including any necessary RPC support.

**Acceptance:** A teacher cannot assign a new unusable exercise. Existing unavailable assignments are clearly labeled. Every enabled catalog entry is covered by a teacher-assign → student-open → finish acceptance test.

### P1-04 — Consolidate ruler work into tenths only [M; application; DB/Auth approval for catalog/testing-data cleanup]

**Evidence:** The assignment page renders the same `PrecisionRuler` for `measurement_ruler_tenths` and `measurement_ruler_hundredths`. It has no precision-mode prop and uses `RULER_SPEC` (0.1 cm markings, 0.01 cm readings) for both.

**Change:** Keep one tenths ruler experience across the catalog, assignments, practice, and measurement questions; remove the separate hundredths offering rather than maintaining compatibility modes. Use the confirmed 0.1 cm reporting precision with compatible printed scale markings and answer tolerance. Update readouts, question pools, feedback, titles, types/registry, and tests consistently. Existing hundredths records are disposable testing data; no historical compatibility layer is required. Explain any catalog/assignment/test-data cleanup and obtain explicit Supabase approval before executing it. New keyboard-control support is out of scope. Do not change passing thresholds, first-answer scoring, or retry policy as part of precision cleanup.

**Acceptance:** Only tenths is offered for ruler work, consistently across assignments and practice. No separate hundredths UI or compatibility mode remains. Any necessary Supabase cleanup is separately approved, and unrelated scoring/retry behavior remains unchanged.

### P1-05 — Clarify current unsaved quiz results; defer persistence, gates, and grading policy [S now; L later; DB/Auth for future persistence]

**Evidence:** Bohr and Lewis route components pass no persistence callback to their quizzes. Measurement quiz uses local reducer state. Existing exploration RPCs record participation, not quiz scores. `ClassActivity.passing_threshold` is not used by current quiz pages.

**Change now:** Explain that current quiz results are not saved or visible to the teacher; preserve separate recorded exploration-completion language. Repair navigation/refresh stability, but leave current pass marks, first-answer scoring, retries, and score handling unchanged. No persistence endpoint, grade-report UI, progression gate, or teacher assessment-policy setting is part of this pass.

**Deferred future direction:** Save quiz results and expose them to teachers. Review persistence, teacher-configurable progression, thresholds, and retries together using section 3's questions. A future design needs authorized assignment-scoped attempts, stable question/choice identifiers, server-side evaluation, idempotent submission, and teacher visibility; do not trust a client-submitted score/`passed` flag. Correct answers in current client payloads cannot provide authoritative grading.

**Acceptance now:** Students know what is saved and what teachers can see. Existing grading/retry behavior is unchanged. Tests verify no persistence/gating feature was accidentally introduced.

### P1-06 — Preserve quiz attempts through background refresh and deadlines [M; application]

**Evidence:** `AssignmentAccess.tsx` refreshes the route every 30 seconds and on focus. `RandomizedQuiz.tsx` redraws questions whenever its `pool` prop changes. A refreshed server response can supply a new array while `QuizShell` retains its index, score, and selection state. This creates a source-level risk of question reshuffling mid-attempt; browser reproduction is still needed. Closing access also hides the quiz abruptly.

**Change:** Freeze the drawn questions for the lifetime of an attempt; redraw only for an explicit new attempt. Keep availability revalidation separate from question initialization. Explain closing time up front; block further assignment submissions at close with no grace period or late-submission option. On closure, show clear saved/not-saved status and a return path. Keep authorized completed work/completion history available read-only through a separate read path. Current quiz answers/results remain unsaved; do not add persistence under the guise of deadline handling.

**Acceptance:** Timer refresh, tab focus, schedule changes, and network retry do not change current questions or silently reset answers. Closed work cannot submit unauthorized mutations. Empty pools exit to a real empty/error state rather than `RandomizedQuiz` showing **Loading questions…** forever.

### P1-07 — Make the student dashboard a useful work queue [M; application]

**Evidence:** `src/app/(student)/student/page.tsx` shows title, UTC deadline, and **Open activity**, but no student/class context or persisted progress. `getStudentAssignments()` excludes both upcoming and closed assignments, so an empty list cannot distinguish “nothing assigned,” “not open yet,” or “everything closed/completed.”

**Change:** Add student name/class, clear **To do / In progress / Completed** states, **Start / Resume / Review** actions, and optional Upcoming/Closed sections. Read availability metadata through an authorized server path; never expose exercise content before opening. Show an actionable empty state: wait for teacher, refresh, or use untracked practice. Do not infer completion from page visits.

**Acceptance:** A returning student can immediately identify the next task and prior completion. No-progress assignments count as not started. Closed work retains an understandable history/status summary without leaking foreign assignment details.

### P1-08 — Put exploration completion in the learning flow [M; application]

**Evidence:** Assignment attempt controls/history appear before the explorer, content is usable before Start, and Finish can immediately follow Start. The page records participation correctly but does not guide the student through it. History occupies primary space.

**Change:** Show a short objective and instructions before the exercise. Explain **Start exploration** is required to record participation; keep page reading free of automatic writes. Place Finish after the exercise and show an announced **Completion saved** with return/quiz options. Collapse old attempts into a disclosure. Add Resume messaging for active attempts and distinguish a new retry from revisiting completed work.

**Acceptance:** Students understand when work is being tracked and what Finish means. Manual completion cannot be mistaken for quiz passage. Save failures are visible and never displayed as completed.

### P1-09 — Replace permanent class deletion with disabling [M; application; DB/Auth approval for flag mutation]

**Evidence:** `src/app/admin/page.tsx` submits **Remove class** immediately. `src/lib/server/classes.ts` performs a hard delete. Database schema tests cover cascades from classes through students/progress/attempts; this is potentially destructive to the entire class history.

**Change:** Replace the class hard-delete action with a server-authorized update of the existing flag: `is_active = false`. Label it Disable class, with named-class confirmation, Cancel, pending/error states, and an explanation that students lose class access but the data remains. Remove the permanent-deletion application path rather than leaving it behind a stronger confirmation. All class-dependent read/mutation paths must consistently honor disabled state. Do not implement disabled-class listing/reactivation UI now; do not promise Undo. Explain and obtain approval before any actual Supabase mutation.

**Acceptance:** No class-removal action issues a database DELETE. Cancellation writes nothing. Disabling retains class/students/assignments/progress/attempt rows, blocks student access and new work mutations, returns the teacher to a valid selection, and confirms the class was disabled. Errors keep it visible.

### P1-10 — Correct teacher progress and distinguish errors from zeros [M; application]

**Evidence:** `src/app/admin/page.tsx` divides completed progress rows by existing progress rows, not all assigned activities. One finished assignment out of five can therefore show 100%. “Completed current activity” uses the last item of a query with no defined chronological/activity order. Student, class-activity, and progress query errors are ignored and converted into empty collections.

**Change:** Define the report denominator and display **X of Y assigned activities completed** (or selected-activity participation). Include missing progress as not started. Use an explicit activity selection/order and clearly distinguish ever-completed from latest-retry status. Handle each query error and avoid showing false student counts or progress. Reuse the attempt report's error-versus-zero discipline. Paginate large rosters/progress reads instead of assuming one query returns every row.

**Acceptance:** A student with one completion of five assignments shows 1/5, not 100%. Failed queries show unavailable data, not a fabricated empty class. Counts remain correct beyond the backend's result cap.

### P1-11 — Add the schedule editor the UI already promises [M; application]

**Evidence:** `saveAssignment()` supports an assignment ID and updating dates, but `AssignmentForm.tsx` always sends an empty `assignment_id`. Existing cards are read-only. Duplicate-assignment errors tell users to “Edit its dates below,” where no editor exists. Catalog selection/form dates also remain after success.

**Change:** Add an **Edit dates** control on existing assignments, prefilled values, save/cancel states, and open/scheduled/closed badges. Confirm changes affecting active work. Reset the new-assignment form after successful creation and identify the saved activity/class. Block assigning when the existing assignment list failed to load rather than treating it as empty.

**Acceptance:** Teachers can extend/reopen/change a schedule without deleting work or trying to reassign a disabled card. Existing attempts survive date edits; duplicate messages point to a real editor.

### P1-12 — Use understandable time zones consistently [M; application]

**Evidence:** Assignment scheduling uses `datetime-local` but asks teachers to enter UTC; server action appends `Z`. Student cards and reports show UTC with differing formats. This is technically labeled but easy to misinterpret when entering classroom deadlines.

**Change:** Prefer local-time entry with an explicit displayed zone, convert to UTC for storage, and format consistently for the viewer. A small reusable date/time component should use semantic `<time>`. Provide exact timestamps where useful; do not rely only on “tomorrow.” Test daylight-saving transitions and deadline boundaries. Keep all actual authorization on server time.

**Acceptance:** A teacher entering 3 PM sees the same instant as a student viewing it locally. Opening/closing behavior agrees with labels; inclusive opening/exclusive closing stays consistent.

### P1-13 — Finish onboarding and shared-device auth UX; defer password recovery [M; DB/Auth approval for verification operations]

**Evidence:** Home's `Get_Started_Button.tsx` sends everyone to teacher login. Student signup returns to `/?accountCreated=true`; the popup's Continue only dismisses to `/`, despite saying the account is ready. Student login has no direct Join/Create account link. Teacher **Forgot password?** invokes an empty function. Teacher verification offers no resend/change-email guidance. Sign-out failures only reach the console.

**Change:** Make role choice explicit; label student registration Join a class and teacher registration Create teacher account. Teachers register freely with email verification, not administrator approval. For the current testing flow, provide an accurate student signup confirmation/sign-in action, optionally preserving non-secret Student ID context. The future flow requires teacher approval, but do not introduce approval controls/enforcement or promise a pending/approved state before that feature exists. Do not implement password recovery in this scope; hide/remove the nonworking Forgot password control. Expired-verification guidance/resend remains a separate proposal requiring approved Auth configuration. Add show-password, password-manager-friendly policy, and dependable form error/pending handling. Do not wipe both password fields for an unrelated display-name/email typo without a specific reason. Make sign-out failures visible and confirm server/client session state before offering success.

**Acceptance:** Neither persona needs to hunt through marketing pages after signup. No visible control promises password recovery before it exists. Verification instructions are accurate; any new verification operation is separately approved. Shared devices have clear sign-out feedback and a usable switch-account route.

### P1-14 — Scoped accessibility polish; defer keyboard-control completion [M; application]

**Evidence:** `GraduatedCylinder.tsx` advertises a focusable ARIA slider but has no keyboard handler. Bohr electrons animate continuously without a reduced-motion/pause path. Mobile menu lacks `aria-expanded`/`aria-controls`. AccountCreatedPopup declares a modal but has no focus trap, focus restoration, or Escape handling. Multiple-choice quiz transitions do not manage focus like the measurement quiz does. Locked measurement graphics deliberately hide the reading but currently provide no equivalent nonvisual problem.

**Change:** Defer new cylinder keyboard controls, keyboard-navigation completion, and a full focus/dialog interaction pass as requested. Preserve existing ruler and measurement quiz support. Remaining proposals: reduced-motion support for orbits, semantic labels/states, consistent main landmarks, and replacing the signup modal with inline confirmation. An equivalent nonvisual measurement task needs a separate scope decision; do not expose the correct answer as a substitute.

**Acceptance:** Existing keyboard support does not regress; reduced-motion and semantic changes are tested if approved. Do not claim full keyboard/screen-reader accessibility while the deferred interaction work remains incomplete.

### P2-01 — Simplify teacher setup and reporting [M; application; DB/Auth approval for new mutations]

**Evidence:** Create-class success clears the form but stays on the page even though the action returns `classId`; codes are manual-only and not copyable. `/admin` puts assignment creation, full catalog, schedules, roster progress, and reports into one long selected-class panel. “Active students” lists enrolled students, not online activity. There is no teacher lesson-preview route; student routes require a student session.

**Change:** After creation, select the new class and show copy-code/join-instructions actions. Add **Generate code** with server uniqueness checks. Use manageable Assignments/Students/Reports areas; preserve selected class in navigation. Rename the roster **Enrolled students**, add stable ordering/search, and give reports a manual refresh/last-updated indicator and concise totals. Add a teacher-only read-only lesson preview using shared explorers without impersonation or attempt creation. Class name/section editing can follow if requested.

**Acceptance:** A teacher can create a class, share its code, preview content, assign work, and find a student's status without navigating a wall of controls. Previewing never writes student progress.

### P2-02 — Remove nonfunctional marketing UI and misleading copy [S; application]

**Evidence:** `Footer.tsx` contains placeholder product/resources/legal links and an email input with no submit path or label. Branding says **Chemistry Curriculum** while the app is ChemClicks. `Lesson_Overview.tsx` tells students to use a username, not Student ID, and uses awkward stability wording. Catalog/lab descriptions promise drawing/building Lewis structures, while current explorers select and display examples.

**Change:** Remove the newsletter and fake Schools/Help/Docs/Guides links unless actual destinations/content are delivered. Add real privacy/help material appropriate to collected student names/IDs before classroom rollout; do not leave Privacy/Terms as `#`. Use consistent ChemClicks branding, Student ID/classroom code terminology, and **Explore** rather than **Draw/Build** where accurate. Remove the empty newsletter placeholder section in `src/app/page.tsx`. Avoid animations/hover styling that imply static marketing cards are clickable.

**Acceptance:** Every visible promise/control is true and functional; no input collects information without explaining its purpose and behavior.

### P2-03 — Improve learning instructions and feedback, not just styling [M; application/content]

**Evidence:** Explorers have informative panels, but assignment pages provide little task-specific guidance. Multiple-choice feedback gives the right answer without an explanation or a review path. Practice and catalog ordering/copy do not define one learning sequence.

**Change:** Add concise learning goals, suggested comparisons/actions, and estimated effort. Provide a consistent reset-to-default control where helpful. Improve non-scoring feedback/review links without changing current pass thresholds or retry/scoring rules; any question-bank/Supabase edits require separate approval. Align catalog, practice, and recommended order after instructor review. Preserve nuanced Bohr shell-capacity/ion-stability explanations; do not simplify them into incorrect “every ion is stable” copy. Define whether a full interactive Lewis builder is actually needed before adding it.

**Acceptance:** Students know what to try and why an answer is wrong. Language accurately describes the supported first-20-elements model, bonding examples, and measurement precision.

### P2-04 — Apply a visual consistency and responsive pass [M; application; browser verification]

**Evidence:** Pages use a mix of `min-h-screen` and `min-h-screen-below-nav`, container widths, card nesting, heading/button styles, and raw versus formatted dates. Small green `text-accent` appears on light card backgrounds; diagrams contain hard-coded colors despite available electron tokens. Actual layouts have not been visually tested in this review.

**Change:** Standardize page shells, spacing, heading hierarchy, action hierarchy, form hints, and loading/error panels using existing tokens. Separate readable success/link text from the bright decorative accent where contrast needs it. Audit SVG colors, long names/formulas, mobile padding, horizontal overflow, roster layout, and focus indicators in both themes. Add distinct page titles for auth, teacher, and assignment pages; do not convert static pages to client components for this work.

**Acceptance:** Core routes work at approximately 320–375 px, tablet, and desktop widths and at 200% zoom. Text/focus/control contrast meets accessibility requirements; no essential scale detail becomes too small to read. Changes are verified in-browser rather than assumed from class names.

### P2-05 — Make empty/error states recoverable in context [S–M; application]

**Evidence:** Closed assignments go through the current available-list lookup and generic not-found UI. Root error UI only offers marketing Home. Teacher/student/report error boundaries use `reset`, while installed Next.js 16.3 documentation distinguishes `retry()` (refetch + rerender) from `reset()` (rerender only). Quiz-load error panels have no clear retry/back action. Forbidden sends even a signed-in student to teacher login.

**Change:** Use state-specific recovery copy and role-appropriate return links. Use Next.js 16.3 `retry()` for transient server fetch errors; `reset` is still supported, but may just replay the failed server result. Give quiz load failures explicit retry/back controls. Add a student assignment unavailable state for known owned work while retaining privacy-safe denial for foreign IDs. Log unexpected errors with useful server-side context/digests and no credential/token leakage.

**Acceptance:** Students/teachers can recover from a temporary outage without restarting their journey or losing saved work. Access problems, closure, and network failure are not all presented as the same condition.

### P2-06 — Remove stale scaffolding and make setup/testing safe [M; repository; DB/Auth approval for migration operations]

**Evidence:** `README.md` describes Next 15/TypeScript 5-era setup, Node 18+, planned Jest tests, and an absent `test:e2e` script, despite the current Next 16/TypeScript 6/Vitest stack. It references missing screenshots and LICENSE. SQL lives in both `src/lib/supabase/migration/` and `supabase/migrations/`; the `.sql.sql` file is byte-identical to its `.sql` counterpart. Historical notes describe obsolete cookies/verified enrollment. `vitest.config.mts` loads environment files and default `npm test` discovers suites that write database/Auth fixtures, including under `tests/database/schema/`.

**Change:** Update README/env/testing docs to actual runtime and commands. Separate safe default unit/component tests from explicitly opted-in dedicated-project database tests; add safeguards against using development/production credentials. Make CI run the safe checks. Archive historical notes with a clear current-contract entry point. Consolidate migration documentation and establish a fresh-database baseline only after auditing existing deployment history; do not rename/reapply already-applied migrations blindly. Remove the duplicate SQL artifact only after confirming references. Audit unused mocks, empty files, `/teacher/dashboard/.gitkeep`, obsolete username-auth helpers, and default SVG assets before removing unreferenced scaffolding. Fix the two lint warnings without unnecessarily changing the intended session-navigation behavior.

**Acceptance:** A new contributor can install/run/test from the README without unknowingly mutating Supabase. One documented auth/activity/deployment contract supersedes historical contradictions. Cleanup does not change deployed migration history.

## 6. Test gaps to close

Passing unit tests are a good foundation, not a classroom-readiness certificate. For example, `tests/routes/route-pages.test.tsx` explicitly expects the nonexistent `/student/quizzes/lewis` link, `tests/assignments/routes.test.tsx` expects Bohr to be unavailable, and `tests/quiz/QuizShell.test.tsx` only checks that Continue exists, not that it works.

### Add or change regression tests

- Login action handles session-helper returned failures and does not redirect on failure.
- Student Auth provisioning cannot produce teacher privileges; test signup/profile recovery using mocks, then approved dedicated-project integration checks.
- Every visible internal navigation/CTA resolves to a route or valid anchor.
- Every enabled catalog activity has supported content and a consistent tracking contract.
- One tenths ruler specification is consistent across catalog, explorer, readout, question pool, and grading feedback; the separate hundredths experience is removed.
- Quiz questions remain stable across refresh/focus; completion CTA actually navigates.
- Deadline closure and rescheduling preserve honest save status.
- Teacher completion denominator includes untouched assignments; data-load errors do not become zeros.
- Assignment dates can be edited, with duplicate submissions and boundary dates covered.
- Disable-class confirmation cancels without mutation; confirmed behavior updates `is_active` rather than issuing DELETE. Disabled-state access checks and errors preserve context.
- Mobile menu semantics, reduced motion, and inline confirmations where approved; retain existing accessibility regression tests. New cylinder keyboard-control and full quiz-focus coverage are deferred.

### Browser acceptance scenarios

Run against local mocked data or an explicitly approved isolated test project. Do not use the existing service-role environment indiscriminately.

1. New teacher → signup → verification/recovery → create class → share code → preview → assign → edit dates.
2. New student → join → sign in → identify class → start/resume/finish assignment → refresh → see saved completion.
3. Teacher → report → same student's zero/start/finish/retry states; untouched student remains zero.
4. Practice → quiz → fail/retry/pass → real return action; no implication of saved credit unless grading was implemented.
5. Scheduled/closed work → explicit state; deadline passes in an open tab → further submissions blocked with no grace/late mode → authorized completed work/history remains read-only; teacher can extend dates.
6. Two teachers/two classes → no cross-class access by URL manipulation or direct database API; student session cannot use teacher functions.
7. Shared device → sign out → back/refresh cannot expose protected work; switch role/account; network failures recover.
8. Light/dark, mobile/desktop, 200% zoom, reduced motion, and regression checks for existing accessibility support. Full keyboard/screen-reader acceptance is deferred, not certified.
9. Large class/assignment lists exceeding a single backend result page.
10. Disable class → related rows retained → student access/new work blocked → teacher sees success; cancellation/failure leaves the class active.

Do not add acceptance scenarios implying saved quiz results, progression gates, changed thresholds/retries, or teacher approval of students are implemented in this pass.

## 7. Suggested implementation sequence

### Phase A — Stop broken/unsafe promises

Approve P0 investigation; fix login false success, resolve provisioning/role conflicts for free teacher registration, replace fake navigation, repair Lewis quiz links, remove inert continuation/misleading gating copy, hide unsupported new assignments, and replace class deletion with confirmed disabling. Remove nonfunctional newsletter/footer affordances. Do not introduce student approval, saved quiz results, progression gates, or threshold/retry changes.

**Exit:** No obvious dead end, no false login success, and role/deployment compatibility is established.

### Phase B — Make assigned work coherent

Deliver dashboard states, supported-content registry/single tenths ruler experience, exploration flow, correct progress, date editing/local-time UX, and clear saved-versus-practice messaging. Fix refresh/deadline question stability. Improve teacher onboarding/preview.

**Dependencies:** P0 compatibility checks and any specific Supabase approval before expanding tracked activities or changing catalog/data. Quiz persistence/progression/threshold/retry questions remain deferred together; student approval is also excluded. Deadline review reads must not weaken submission checks.

**Exit:** One teacher and two students can finish the complete classroom journey and agree on what was saved.

### Phase C — Make it accessible and polished

Deliver approved motion/semantic polish, consistent page/error shells, copy/learning explanations, responsive/contrast verification, safe test separation, current documentation, and browser regression coverage. Keyboard-control completion and full nonvisual measurement/focus work are deferred.

**Exit:** The core journeys are verified across target screen sizes and guarded by behavioral tests. Preserve existing input-method support without claiming full accessibility certification.

### Phase D — Deferred assessment and student approval

Not part of the current implementation scope: saved quiz results/teacher result reporting; possibly teacher-configurable progression; threshold, retry, and best/latest-score policy changes; teacher approval of student join requests. Revisit the three assessment topics together before designing them. Student approval needs its own end-to-end policy and server enforcement. Reactivation UI, roster corrections, and multi-class support require separate decisions. No permanent class deletion is planned.

Each future database/Auth change gets its own explained approval and deployment plan. Current plans may fix provisioning/role separation without implementing enrollment approval.

**Defer:** Quiz-result persistence, progression, threshold/retry changes, student-approval implementation, password recovery, and keyboard-control completion, per review. Also defer new state libraries, a broad design-system rewrite, an extra teacher dashboard route, newsletter/email marketing, analytics, gamification, exports, or more chemistry modules until the core flow is reliable.

## 8. Validation performed for this review

```sh
npx vitest run tests/auth tests/assignments tests/routes tests/measurement tests/quiz tests/chemistry tests/bohr tests/ui
# 40 files passed; 380 tests passed

npx tsc --noEmit --incremental false
# Passed

npm run lint
# 0 errors; 2 warnings:
# src/app/login/student/page.tsx: internal window.location.href navigation
# src/proxy.ts: unused User import
```

The full `npm test`, database schema/integration suites, SQL assertion suites, production build, live migrations, and manual browser acceptance were **not** run. Installed Next.js error-handling documentation/runtime was checked when assessing retry behavior.

## 9. Review checklist

- [x] Record: future saved quiz results visible to teachers; implementation deferred.
- [x] Record: possibly teacher-configurable progression; undecided and implementation deferred.
- [x] Record: leave thresholds/retry/scoring rules unchanged; review with persistence/progression later.
- [x] Record: free teacher registration; future student approval required, but do not implement it now.
- [x] Record: disable classes via active flag; no permanent deletion.
- [x] Record: no submissions after close; completed work/history available read-only.
- [x] Record: separate untracked Practice labs; tenths ruler only; old records are testing data.
- [x] Record: password recovery and keyboard-control completion deferred.
- [x] Confirm: ruler answers reported to 0.1 cm; compatible scale/tolerance to be chosen during implementation.
- [x] Confirm: no disabled-class list/reactivation UI for now.
- [x] Confirm: current student access remains unchanged during testing while approval implementation is deferred.
- [ ] Approve read-only deployment/provisioning investigation; separately review any resulting DB/Auth changes or testing-data cleanup.
- [x] Authorize beginning application implementation (user request); the first scoped slice is tracked above. This does not authorize Supabase writes or certify phase completion.
- [ ] Approve Phase C polish/testing/documentation scope.

**Definition of polished:** A student always knows which class they are in, what to do next, whether their work was saved, and how to recover. A teacher can assign usable work, safely manage a class, and trust what the dashboard reports. No visible control is a placeholder, and no page promises a workflow the application does not actually support.
