# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Existing production project maintenance and feature development.

## Current Goal

- Upgrade messaging into a production-ready text, photo, document, and
  voice system across internal web and mobile while preserving existing
  conversations and backend authorization boundaries.

## Completed

- Rearranged the internal software sidebar into the requirements-defined
  sections: Dashboard, Academics, Student, Staff, Exam, Utilities, Reports,
  and Settings Section. Added matching navigation labels for Class, Subject,
  Assign Subject, Student Info, Student Attendance, Teacher Attendance, Chat,
  Exam Report, and General Settings while preserving existing route guards.
- Documented the current database model as domain-level Mermaid ERDs with a
  reusable visual-ERD generation prompt in `ERD.md`.
- Analyzed the repository layout: backend, internal software app,
  public website, mobile app, shared API helper, uploads, migrations,
  jobs, and scripts.
- Documented backend route layering, auth, RBAC, database access,
  module pattern, and realtime SSE usage.
- Documented frontend boundaries and UI conventions for internal web,
  public website, and mobile.
- Captured current validation setup and known operational gaps.
- Added OTP-based login for new/suspicious devices using Fast2SMS
  Smart OTP, hashed OTP challenges, trusted devices, resend limits,
  and wrong-attempt blocking.
- Added internal web `/verify-otp` flow and mobile OTP verification
  state for new-device login.
- Hardened OTP login against duplicate sends by reusing active
  challenges during cooldown and disabling duplicate web login submits.
- Added the backward-compatible full messaging migration with media,
  replies/forwards, edit/delete, receipts, reporting, suspension, and
  audit structures.
- Added private local/S3-compatible messaging storage, file-signature
  validation, image compression/thumbnails, audio-duration validation,
  authorized short-lived media access, and retention cleanup.
- Added backend messaging APIs for attachments, typing, search,
  delivery/read state, edit/delete, reporting, moderation, export, and
  group membership.
- Added internal web and mobile photo, document, and recorded voice
  messaging with preview/playback, replies, forwarding, editing,
  deletion, reporting, search, typing, and receipt display.
- Applied and verified the messaging migration in the configured local
  MySQL database and passed a reversible local media upload smoke test.
- Applied non-breaking dependency security updates. Backend production
  dependencies audit with zero known vulnerabilities.
- Fixed teacher attendance forwarding by exposing the shared-key sync
  ingress at `/api/v1/sync`, updating agent defaults to the proxied
  production path, and retaining the MSSQL agent used by attendance
  source computers.

## In Progress

- Validate final web/mobile production builds and configure a private
  S3-compatible provider before production deployment.

## Next Up

- Configure production S3-compatible credentials and run upload,
  signed-download, lifecycle, and deletion tests against that provider.
- Add dedicated automated backend tests for messaging authorization,
  attachment validation, edit/delete windows, and broadcast reply
  restrictions.
- Add missing `.env.example` files if environment onboarding is a
  priority.
- Add `FAST2SMS_ACCOUNTS_OTP_ID` and `FAST2SMS_DEFAULT_OTP_ID` after
  approval, if not already present.
- Decide whether cron jobs should be wired into backend startup or run
  as separate processes.
- Decide whether `backend/modules/iclock` routes should be mounted.
- Add automated tests around auth/RBAC and high-risk domain modules.
- Keep migration history current for any schema-dependent feature work.

## Open Questions

- Should fee reminder and iclock pull jobs start inside
  `backend/server.js`, through PM2, or as separate worker processes?
- Should `backend/modules/iclock/iclock.routes.js` and
  `iclock.admin.routes.js` be publicly mounted, protected mounted, or
  left dormant?
- What is the intended production storage strategy for uploads:
  local disk, shared volume, or external object storage?
- Should web auth continue storing tokens in `localStorage`, or should
  a future hardening pass move toward httpOnly cookie flows?
- Which domain modules should receive tests first: auth/RBAC, fees,
  attendance, marks, or messaging?
- Should the suspicious-login failed-password threshold remain 3
  failures in 24 hours, or be made configurable?

## Architecture Decisions

- Express/MySQL remains the backend source of truth because current
  modules, migrations, repositories, and clients are built around it.
- Backend route middleware is the authorization boundary; frontend
  route/tab filtering is for usability only.
- Migrations are the authoritative schema-change mechanism; reseeding
  is reserved for targeted seed data.
- Public website APIs stay under public route mounts and must not
  require user JWTs for visitor-facing reads/submissions.
- Mobile keeps its separate Axios/cache layer because it has different
  persistence and offline/stale-response needs than the web clients.
- OTP is required only for new devices or suspicious logins; successful
  OTP verification trusts the device and regular refresh-token behavior
  remains unchanged.
- The mobile apps are already published. Future Android and iOS
  submissions are production updates and must preserve package/bundle
  identifiers while incrementing store-required build versions.
- Only super admin may initiate conversations. Other authorized members
  may reply where the conversation type permits it.
- Student-directed messages are delivered to linked parent or guardian
  user accounts.
- Direct chats support typing indicators. Class and section chats are
  shared discussions. Broadcast chats are announcement-only.
- Production messaging media uses private S3-compatible object storage;
  development may use a local storage driver through the same backend
  abstraction.
- Messaging downloads require membership authorization and short-lived
  access. Permanent public attachment URLs are not used.
- Messaging uploads use MIME, extension, file-signature, and size
  validation. Malware scanning is not required.
- Existing messages remain compatible while richer attachment,
  reply/forward, edit/delete, receipt, and moderation metadata is added
  through a new migration.

## Session Notes

- Root docs `README.md` and `SYSTEM_OVERVIEW.md` already summarize
  much of the current system.
- Real `.env` files exist in backend, internal software, and mobile;
  avoid exposing their values in docs or commits.
- No real backend test suite is wired. Web apps have lint/build
  scripts. Mobile has TypeScript checking.
- Permission cache TTL is 10 minutes, so permission changes may not be
  visible immediately without cache clearing or restart.
- Android updates should use EAS production builds that generate an
  `.aab` for Play Store upload.
- Production mobile builds should point at
  `https://kalongkapilividyapith.com/api/v1`.
- Mobile retains 11 moderate npm audit findings in the Expo 54
  toolchain. npm requires a breaking Expo 56 upgrade to remove them, so
  no forced SDK upgrade was performed during the messaging change.
- Internal software sidebar navigation now uses grouped uppercase section
  labels with indented child tabs; label, item, and active states have
  separate color and font weights to make the hierarchy clearer.
- Added the first subject-choice implementation unit: non-destructive
  `subject_offerings` and `student_subject_registrations` migration,
  protected backend APIs for offerings and per-student subject choices,
  internal web subject-choice UI, and marks/exam filtering that respects
  permanent student subject registrations when present.
- Split class subject assignment into a dedicated internal web page at
  `/subjects/assign-class`, keeping the subject master page focused on
  subject records while the new page shows assigned subjects in a table
  and owns the "Assign Subjects" dialog.
- Added `templates/design.md` as the project-wide practical design guide
  for internal web, public website, and mobile UI changes, and added it
  to the required template reading order.
- Adjusted the Assign Subject to Class cards so each class stays visually
  highlighted while assigned subjects wrap side by side with neutral
  divider bars instead of a table or grid layout.
- Redesigned the Assign Subject to Class page toward the SaaS admin
  direction in `redesign.md`: collapsible class cards, compact header
  metadata, per-class Assign/Edit actions, nested subject rows, soft
  badges, and a designed empty state while preserving the existing data
  flow and dialog behavior.
- Added a Subject Selection tab to the Student Details screen beside
  Parents, with simple checkbox-based student subject registration,
  compulsory subjects locked as required, staff save action, and
  read-only behavior for users without student update permission.
- Compacted the Assign Subject to Class page by removing the large
  class-subject summary panel and replacing accordion cards with a
  responsive class grid that shows subjects inline with colored
  compulsory/elective/optional badges.
- Removed subject codes from the Assign Subject to Class card display,
  keeping inline subject names with group badges only.
- Tightened spacing between class headers and inline subjects in the
  Assign Subject to Class grid cards.
- Removed the default card gap from Assign Subject to Class cards,
  moved Assign/Edit beside the scope badge, and added colored scope
  badges for school and higher secondary classes.
- Added a dedicated Assign Teacher to Class page and sidebar tab at
  `/teachers/assign-class`, reusing the existing teacher assignment API
  while keeping the assignment functionality in Teacher Details intact.
- Changed the Assign Teacher to Class assignment display to an
  accordion list grouped by class, with teacher assignments shown inside
  each expanded class panel.
- Refined Assign Teacher to Class accordion panels so teachers are the
  primary nested cards, with assigned classes/sections separated from
  assigned subjects similar to the Teacher Details hierarchy.
- Updated Assign Teacher to Class to select subjects from active
  `subject_offerings`, allow removing individual teacher assignments,
  validate assignments against offered class subjects, and make teacher
  assignment creation duplicate-safe for the same teacher/class/section/
  subject/session combination.
- Updated the Teacher Details assignment dialog to use active
  `subject_offerings` as its subject source, keeping the existing
  teacher-details assignment and removal workflow aligned with the
  dedicated Assign Teacher to Class page.
- Split the Attendance page tab navigation by context: Student
  Attendance now shows only student attendance tabs, while Teacher
  Attendance shows only teacher logs and device mapping tabs.
- Added an idempotent migration to enforce DB-level duplicate
  protection for `teacher_class_assignments` through
  `uniq_teacher_assignment`, with a duplicate precheck that fails
  clearly before altering production data.
- Updated the Exams UI so exam subject selection is driven by active
  `subject_offerings` for the selected class scopes, with subject group
  badges and scope-change pruning for new exam creation.
- Redesigned the Exams UI to match the newer card-based academic pages:
  larger two-column create/edit dialog, shadcn cards for exam setup and
  exam listing, clearer offered-subject selection, mark-pattern badges,
  and visually grouped scope/subject metadata.
- Removed Custom Student Subject Mapping from the Exams dialog so
  student-specific elective/optional choices are managed through
  Student Details registrations instead of duplicate per-exam mapping UI.
- Added the backend/database foundation for linking exam subjects to
  `subject_offerings`: an idempotent nullable `subject_offering_id`
  migration with safe unique-match backfill, API read/write compatibility,
  and create/update inference that only stores an offering when the selected
  exam scopes resolve to one active offering.
