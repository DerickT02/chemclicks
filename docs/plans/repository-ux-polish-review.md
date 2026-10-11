# ChemClicks — finish checklist

Build a straightforward classroom tool for a teacher, not every feature in the original audit. Detailed historical findings and validation are archived in [the review history](archive/repository-ux-polish-review-history.md).

## Agreed application scope

- [x] Student joining ends with inline confirmation and a direct student sign-in link; no marketing-page modal or automatic login.
- [x] Class creation opens the new selected classroom; offer copy-code feedback and short student joining instructions.
- [x] Assigned exploration follows instructions → Start → exercise → Finish; show confirmed completion and collapse saved attempts. Revisiting completed work does not automatically create a retry.
- [x] Own saved exploration history is readable after closing, with no exercise controls or submission forms. Upcoming/invalid/foreign/inactive-class work does not gain history access.
- [x] Ruler follows `dev`'s staged comparison: a 0–10 cm tenths ruler first, then a hundredths ruler sharing the same reading. Both ruler activities are assignable and each has its own measurement quiz mode. This replaces the earlier tenths-only decision (one ruler, ±0.1 cm, hundredths retired), which was dropped when `dev` was merged on 2026-10-11.
- [x] Schedule editing uses Save/Cancel. Only changes that make currently open work unavailable immediately require confirmation. Keep server validation, ownership, original-window conflict checks, and confirmed-write feedback.
- [x] Dashboard refresh is manual/on focus, without polling or per-card status clocks. Keep active-exercise deadline checks and server submission enforcement.
- [x] Provide concise classroom help and a factual description of stored student information at `/help`, including saved quiz scores; do not invent a school retention policy or claim verified production security.

These marks describe application implementation, **not deployed acceptance**.

Validation after merging `dev` (merge commit `70b7bb4`): `npm test` passed **84 files / 859 tests**, including `dev`'s `tests/classes` suite, which is now in the unit-test allowlist; TypeScript, lint and a production build passed. The full suite also passed under two non-UTC time zones with non-English locales (Asia/Tokyo with de-DE, America/New_York with fr-FR). No migrations, fixtures, Auth changes, or browser acceptance were run.

## What merging `dev` changed

`dev` brought in work this pass had listed as out of scope. It is now part of the application, and screens and help text were corrected to match:

- Assigned Bohr, Lewis and measurement quizzes are graded and saved on the server. Teachers see the scores under Activity attempts, and a passed quiz links to the next assigned section.
- Teachers can unassign (archive) an activity, see named per-lesson student progress on the dashboard, generate classroom codes, and reset a forgotten password. Class name and section must be unique per teacher.
- The graduated cylinder gained a whole-milliliter scale and keyboard control.

Where both sides had built the same thing, this pass's version is the one in use: the schedule editor (device-local times, confirmation, conflict checks), opening the new classroom after class creation, device-local timestamps, and the guided Start → Finish exploration flow. `dev`'s `AssignmentScheduleForm` and `UtcScheduleInputs` remain in the repository but are not rendered; neither are this pass's `getClassCurrentProgress` and `summarizeCurrentExplorations`, which the lesson progress list replaced.

**Open: Bohr assignments are not implemented.** Bohr lessons have no assigned exploration, so new Bohr assignments stay blocked. The Bohr quiz only unlocks from an open Bohr assignment, so it is unreachable for any class that does not already have one. Unblocking needs an assigned Bohr experience, or at least a quiz link on the Bohr assignment page, and is separate work.

## Verify once, then stop adding polish

- [x] Safe local tests, TypeScript, lint, and whitespace checks pass.
- [ ] Teacher browser journey: signup/verification → create class → copy code → assign supported work → edit dates → view the student's saved participation and quiz scores → unassign an activity.
- [ ] Student browser journey: join → sign in → Start → explore → Finish → refresh → see saved completion → finish an assigned quiz and see the saved result → view read-only closed history.
- [ ] Shared device: sign out, back/refresh, and switch account without exposing the previous session's work.
- [ ] Deadline: active exercise stops accepting work at close; extending the schedule works; closed-history pages cannot submit.
- [ ] Core pages are readable at mobile/desktop widths, both themes, and 200% zoom. Fix demonstrated readability/overflow problems only; no broad redesign.

Do not run browser journeys or fixtures with existing application credentials. Use an explicitly approved isolated target or genuinely mocked local data.

## Separate gate before real classroom use

**Needs specific explained approval:** read-only deployed Supabase/Auth investigation for teacher signup provisioning, student/teacher permission isolation, grants/RLS/privacy, and supported attempt RPCs. The historical signup trigger may create teacher profiles for student Auth identities. Repository SQL and passing mocked tests do not establish the live state.

Any resulting database/Auth/configuration change, migration, fixture operation, or test-data cleanup needs its own approval. No blanket migration deployment.

`dev` added seven migrations (assignment archiving, quiz attempt metadata, server-graded quiz attempts, measurement quiz attempts and their teacher results, class name/section uniqueness, and teacher lesson progress). Whether they are deployed is unknown. Saved quizzes, measurement quiz history, unassigning and the lesson progress list depend on them.

The teacher/site operator must also agree on appropriate classroom identifiers and data retention/removal before using real student information.

## Out of scope

No assigned Bohr experience, passing-threshold/scoring/retry-policy changes, quiz settings, student approval workflow, reactivation UI, teacher previews, roster search, exports, new dashboards, design-system rewrite, or migration-history/scaffolding project.

Quiz-result persistence and reporting, quiz progression, password recovery, generated classroom codes and cylinder keyboard control were out of scope for this pass and arrived through `dev` instead; this pass did not build them.

## Definition of done

A teacher can create a class, share its code, assign usable work, adjust dates, and trust the saved-participation report. A student knows which class they are in, what to do, how to save exploration completion, and how to return or view saved history. Navigation and feedback work, and every screen states accurately what is saved: exploration participation and assigned quiz scores, not untracked practice.

Once the listed journeys pass and the deployment/privacy gate is cleared, this polish pass is finished. New requests become separate work rather than extending this checklist.
