# AI Workflow Rules

## Approach

Work incrementally against the existing LMS architecture. The context
files define product scope, boundaries, UI conventions, and current
operational caveats. Before making architectural or cross-module
changes, read the relevant context file and verify the current source
still matches it.

## Question-Only Requests

- If the user asks a question, answer the question directly and do not
  implement code, edit files, run migrations, or change behavior unless
  the user explicitly asks for an implementation or fix.
- Treat requests phrased as "is it", "will it", "do we have", "what
  happens", "what should we do", or "do not implement" as discussion
  only.
- If a question reveals a likely bug or improvement, explain the current
  behavior and the recommended next step, then wait for explicit
  approval before changing files.

## Scoping Rules

- Work on one feature unit at a time
- Prefer small, verifiable increments over large speculative changes
- Do not combine unrelated system boundaries in a single implementation
  step
- Keep backend, internal web, public website, mobile, migrations, and
  sync agents as separate boundaries unless the task explicitly spans
  them.
- When a feature spans client and server, implement the backend
  contract first, then update the client integration.

## When to Split Work

Split an implementation step if it combines:

- Backend route changes and unrelated UI redesign.
- Database migration plus unrelated frontend cleanup.
- Mobile cache/auth changes plus unrelated screen layout changes.
- Public website content management plus internal LMS permissions.
- Attendance sync agent behavior plus normal attendance UI behavior.
- More than one unrelated domain module, such as fees and exams.

If a change cannot be verified end to end quickly,
the scope is too broad. Split it.

## Handling Missing Requirements

- Do not invent product behavior not defined in the context files
- If a requirement is ambiguous, resolve it in the relevant context
  file before implementing
- If a requirement is missing, add it as an open question in
  `progress-tracker.md` before continuing
- If current code contradicts a context file, inspect source first and
  update the context file as part of the change.

## Protected Files

Do not modify the following unless explicitly instructed:

- `node_modules/**`
- `.git/**`
- Real `.env` files, except when the task is explicitly environment
  configuration and no secrets are exposed.
- Existing database migrations after they have been shared or applied;
  add a new migration instead.
- Generated or third-party UI primitives in `components/ui` unless the
  task is specifically about the design system.
- Uploaded production-like files unless the task is specifically file
  cleanup or upload handling.

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- System architecture or boundaries
- Storage model decisions
- Code conventions or standards
- Feature scope
- Route/auth/RBAC behavior
- Public website content-management behavior
- Mobile caching/auth behavior
- Job or sync-agent startup behavior

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope
2. No invariant defined in `architecture.md` was violated
3. `progress-tracker.md` reflects the completed work
4. Relevant validation has been run or explicitly documented as not run

## Production Release Rules

- Treat every release as an update to an existing production system.
- Do not change Android package name or iOS bundle identifier unless
  explicitly instructed.
- For Android Play Store updates, build an AAB with the production EAS
  profile and ensure `versionCode` increments.
- For iOS App Store updates, build with the production EAS profile and
  ensure the iOS build number/version is acceptable to App Store
  Connect.
- Confirm production API and OTP delivery work before submitting
  mobile updates.
- Use staged rollout, internal testing, closed testing, or TestFlight
  for risky changes before broad release.

Suggested validation by area:

- Backend: run the targeted endpoint manually or run the relevant Node
  script if one exists. There is currently no real backend test suite.
- Internal web: `npm run lint` and `npm run build` from
  `frontend/software` when touching web app code.
- Public website: `npm run lint` and `npm run build` from
  `frontend/website` when touching public site code.
- Mobile: `npm run typecheck` from `frontend/mobile` when touching
  TypeScript/mobile code.
- Database: apply or review migrations in a local database before
  relying on schema-dependent behavior.
