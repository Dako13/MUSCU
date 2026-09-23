# Dko Coach: architecture and next features

## First release

One PWA, two coaching views. Google sign-in is shared with the existing private
backup system. No separate subscription, email provider or new hosting service
is introduced. Supabase plan quotas still apply; free usage is not unlimited.

- Student explicitly enables sharing and gets a permanent 128-bit UUID-derived
  code (122 random bits). Any authenticated, non-anonymous account holding it
  can become a coach with full program-edit rights immediately.
- Student controls each relationship: full, read, blocked. Entering the code
  again never elevates an existing read-only or blocked relationship.
- Rotating the code prevents new links using the old code, without changing
  existing relationships. Disabling sharing clears the code and blocks every
  existing coach. Blocking identifies an account, not a real-world person:
  rotate the code too if someone could reuse it through another account.
- Full access covers programs and prescriptions only. Recorded performances,
  credentials, sharing permissions, profile and body measurements remain outside
  the coach's write scope. Exercise feelings are shared only with a separate opt-in.
- Historical workouts are projected from the student's private backup through a
  whitelist; coaches never receive or query that backup directly.

## Ownership boundaries

`coach-sync.js`: pure program synchronization and optimistic concurrency.
`coach-ui.js`: consent, identity guards, student/coach views, draft editor and
application of received programs. `coach.css`: styles using the existing themes.
`cloud-ui.js`: exposes an authenticated context, not administrative credentials.
`app.js`: navigation hooks, dirty-draft guard, change and restore notifications.

The existing program, history and settings storage keys are unchanged. There is
no automatic enrollment or upload to coaching. The new account-specific
`dko_coach_base:<project>|<user>` key is synchronization metadata only and must
never be restored from a backup or reused for another account.

Coach drafts and student dossiers are memory-only: they are not added to the
coach's localStorage, IndexedDB, service worker cache or personal backups.
A draft can be exported deliberately. Closing/reloading the page without
publishing discards it after the browser's unsaved-changes warning. A temporary
network failure retains the draft in memory. Signing out clears it.

## Server contract

Public RPC: `dko_coach(action, args)`. All calls include the expected authenticated
account in `args.account`; the database compares it with `auth.uid()` to prevent
an in-flight account switch writing into the wrong account.

Actions: register, self, enable, rotate, notes, disable, permission, join,
students, read, publish, history, ack. Coach reads/publications use `args.student`.
Publication includes `revision`, the complete normalized program array and a
short change summary. A stale revision raises SQLSTATE `40001`, not last-write-wins.

Private schema `dko_coach_private` owns members, links, versions and attempt
counters. Its tables have RLS enabled, no policies and no direct grants to API
roles: deny by default. The only granted private function is the audited
security-definer gateway, with empty search_path and explicit JWT checks in every
cross-account path. The public wrapper is security-invoker. The private schema
must not be added to PostgREST exposed schemas. Only the migration owner owns it.

Limits: 20 code attempts/account/hour; 2 MiB program document; 100 programs,
100 sessions/program and 100 exercises/session; last 20 program versions;
200 students in the overview, 500 most recent workouts per dossier.
These are intentional initial limits, not pagination guarantees.

## Synchronization and recovery

- Canonical shared programs are separate from whole-account backups.
- Each device tracks its last shared revision and canonical program hash.
- Local unchanged + remote changed: receive. Remote unchanged + local changed:
  publish with revision precondition. Both changed or missing base: explicit
  comparison. Export both versions before choosing when necessary.
- Restoring/importing programs invalidates the local base, including requests
  already in flight. A stale backup cannot silently overwrite the shared plan.
- Received programs wait while a workout, personal editor or import is active.
  An IndexedDB recovery copy is required before writing programs. A last check
  verifies account, editor/workout state and local storage before the write.
- Completed workout snapshots and active session prescriptions are not replaced.
- Acknowledgment is sent after a successful local write; it means at least one
  device received that version, not that every device is current or that the
  student read it. The coach interface labels it accordingly.
- Foreground polling runs about every 30 seconds and on relevant changes/resume.
  A PWA cannot guarantee delivery while suspended on an iPhone. No background
  notifications, Realtime channel or delivery-time promise is implied.
- Blocking is effective on the next server request. An already downloaded or
  exported document cannot be remotely erased from another person's possession.

## Extension plan

1. Paginated student/workout reads, then compact activity indicators. Keep the
   same access checks; add cursor-based actions rather than enlarging full reads.
2. Coach comments in a separate table keyed by relationship, workout ID and
   author. Do not edit the student's historical workout records to add comments.
3. One-shot reports as immutable, explicitly generated snapshots with a separate
   consent and recipient scope. They must not create a permanent relationship.
4. Reusable coach templates as coach-owned documents, copied with fresh IDs into
   a student draft. A template update must never mutate students implicitly.
5. Program calendars and review reminders as independent records referencing
   program/session IDs and revisions, not embedded account settings.
6. Optional delivery notifications only after a reliable provider and consent
   are selected. Program version checks remain mandatory even with Realtime.

Do not introduce a generic plugin framework or split the app into separate
deployments before an actual feature needs it. Preserve the program-channel API
when extracting the remaining monolith gradually.

## Verification

- `tests/coach-sql.cjs`: real PostgreSQL engine via PGlite, private access,
  full/read/blocked, code rotation, rate limits, account binding, payload bounds,
  CAS, version history and deletion cascades.
- `tests/coach-sync.cjs`: deterministic sync decisions and lifecycle races.
- `tests/coach-browser.cjs`: isolated student/coach browser contexts using the
  actual SQL RPC, editor, custom exercise fallback, publication/receipt,
  existing data preservation, active-workout protection, rights changes,
  restore conflicts and responsive screenshots in both themes.
- Existing cloud, library and workout regressions continue to run. Headless
  Chromium tests do not replace physical iPhone/Safari validation.

Deployment: Supabase migration `20260923092448_dko_coaching`, applied 2026-09-23.
`tests/coach-remote-rls.sql` also passes against the deployed database, with
synthetic users and a full rollback (no emails or retained test accounts).

The security advisor reports informational [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
for the four private tables; deny-all is intentional. Existing warnings concern
the project's `rls_auto_enable` event trigger ([anonymous EXECUTE](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)),
the authenticated backup RPC ([security-definer EXECUTE](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)),
and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
This release does not change those pre-existing settings; the app uses Google
OAuth, and the backup RPC has explicit ownership and revision checks.

Known pre-existing visual test gap: `quality-regressions.cjs` fails the homepage
first-viewport Start-button position at 320 x 568, on both this release and the
unchanged 2592711 baseline. The coaching layouts pass 320/390/1280px checks;
the general homepage compact-height layout needs a separate follow-up.
