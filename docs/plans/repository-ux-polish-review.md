# ChemClicks — finish checklist

Build a straightforward classroom tool for a teacher, not every feature in the original audit. Detailed historical findings and validation are archived in [the review history](archive/repository-ux-polish-review-history.md).

## Agreed application scope

- [x] Student joining ends with inline confirmation and a direct student sign-in link; no marketing-page modal or automatic login.
- [x] Class creation opens the new selected classroom; offer copy-code feedback and short student joining instructions.
- [x] Assigned exploration follows instructions → Start → exercise → Finish; show confirmed completion and collapse saved attempts. Revisiting completed work does not automatically create a retry.
- [x] Own saved exploration history is readable after closing, with no exercise controls or submission forms. Upcoming/invalid/foreign/inactive-class work does not gain history access.
- [x] Reuse the existing ruler branch's scale/pointer improvements; remove its hundredths mode. Use one 0–10 cm ruler, 0.1 cm markings/readings and ±0.1 cm answer tolerance across practice, assignments, and questions. Keep quiz thresholds, first-answer scoring, and retries unchanged. Enable tenths assignments; retain only a retired label for old hundredths database rows, not a compatibility exercise.
- [x] Schedule editing uses Save/Cancel. Only changes that make currently open work unavailable immediately require confirmation. Keep server validation, ownership, original-window conflict checks, and confirmed-write feedback.
- [x] Dashboard refresh is manual/on focus, without polling or per-card status clocks. Keep active-exercise deadline checks and server submission enforcement.
- [x] Provide concise classroom help and a factual description of stored student information at `/help`; do not invent a school retention policy or claim verified production security.

These marks describe application implementation, **not deployed acceptance**. Reused ruler changes from local commits `48405cf` and `d596cc1`, adapted to one tenths-only specification; no merge of that branch, database cleanup, or unrelated meniscus work was performed.

Validation: `npm test` passed **69 files / 740 tests** after the simplification pass (single-query reads, browser-local date entry and display); TypeScript and lint passed. The full suite also passed under a non-UTC time zone and a non-English locale, and a production build compiled in an isolated copy with placeholder settings. No live Supabase operations, fixtures, migrations, Auth changes, or browser acceptance were run.

## Verify once, then stop adding polish

- [x] Safe local tests, TypeScript, lint, and whitespace checks pass.
- [ ] Teacher browser journey: signup/verification → create class → copy code → assign supported work → edit dates → view the student's saved participation.
- [ ] Student browser journey: join → sign in → Start → explore → Finish → refresh → see saved completion → view read-only closed history.
- [ ] Shared device: sign out, back/refresh, and switch account without exposing the previous session's work.
- [ ] Deadline: active exercise stops accepting work at close; extending the schedule works; closed-history pages cannot submit.
- [ ] Core pages are readable at mobile/desktop widths, both themes, and 200% zoom. Fix demonstrated readability/overflow problems only; no broad redesign.

Do not run browser journeys or fixtures with existing application credentials. Use an explicitly approved isolated target or genuinely mocked local data.

## Separate gate before real classroom use

**Needs specific explained approval:** read-only deployed Supabase/Auth investigation for teacher signup provisioning, student/teacher permission isolation, grants/RLS/privacy, and supported attempt RPCs. The historical signup trigger may create teacher profiles for student Auth identities. Repository SQL and passing mocked tests do not establish the live state.

Any resulting database/Auth/configuration change, migration, fixture operation, or test-data cleanup needs its own approval. No blanket migration deployment. Old hundredths test rows may be removed only with approved cleanup; their labels remain hidden from the selector and cannot open an exercise.

The teacher/site operator must also agree on appropriate classroom identifiers and data retention/removal before using real student information.

## Out of scope

No quiz-result persistence/reporting, progression/settings, passing-threshold/scoring/retry-policy changes, student approval workflow, password recovery, reactivation UI, teacher previews, generated classroom codes, roster search, exports, new dashboards, keyboard-control expansion, design-system rewrite, or migration-history/scaffolding project.

## Definition of done

A teacher can create a class, share its code, assign usable work, adjust dates, and trust the saved-participation report. A student knows which class they are in, what to do, how to save exploration completion, and how to return or view saved history. Navigation and feedback work, and no screen promises saved quiz grades.

Once the listed journeys pass and the deployment/privacy gate is cleared, this polish pass is finished. New requests become separate work rather than extending this checklist.
