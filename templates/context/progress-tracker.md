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
- Updated the single-exam report card layout to remove the address from
  the header, show Exam and Class/Section in the header, and move the
  student details grid to Student/Roll followed by Guardian/Medium.
- Added payment CSV bulk upload support with a downloadable import
  format and renamed the existing payment export action to Download
  Payment Data.
- Updated payment CSV bulk upload to follow the student bulk entry
  pattern, using student/session/class/section/fee item information
  instead of requiring internal student fee IDs.
- Added theory/practical/total split mark display in final marksheet
  exam cells when a subject has component marks, matching the
  `marksheet.md` Computer example.
- Fixed report and mark statement native dropdown styling so select
  controls and options use dark-mode-safe background and text colors.

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
- OTP is required for every production password login. Non-production logins
  can trust verified devices so only new devices or suspicious logins require
  OTP. Regular refresh-token behavior remains unchanged.
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
- Aligned marks, exams, and legacy reports repositories so report and roster
  queries prefer exact `exam_subjects.subject_offering_id` matches when the
  column exists, fall back to legacy `subject_id` rows, and continue to run
  against databases that have not applied the new column migration yet.
- Fixed class update reconciliation so sections are identified by
  `(name, medium)` instead of name alone, allowing same-named sections such as
  Commerce in English and Assamese media to coexist during class updates.
- Refined Assign Teacher to Class so class accordions start collapsed, teacher
  assignments render side by side without nested teacher cards, and scope is
  shown once at the class level instead of duplicating class and teacher badges.
- Removed the Choose Student Subjects workflow from the Subjects page so
  student subject registration is managed only from Student Details.
- Made teacher deletion remove linked teacher attendance rows transactionally
  before deleting the teacher, so attendance foreign keys no longer block
  deleting a teacher from the Teachers tab.
- Added optional exam subject branch components for cases like Biology split
  into Botany and Zoology: setup stores branch max/pass marks, marks entry saves
  branch marks separately, and parent subject totals continue through the
  existing approval and report-card flow.
- Added colorful subject group badges to Student Details subject selection,
  matching the compulsory/elective/optional visual language used elsewhere.
- Scoped exam visibility by class scope: exam lists now expose scope metadata,
  Student Details loads only exams matching the student's active enrollment,
  and the Exams tab groups cards into School and Higher Secondary sections.
- Updated Reports to include a School/Higher Secondary scope filter for marks
  entry, pending review, and approved-report workflows, with pending approval
  queue metadata carrying class scope into the auto-selected review context.
- Added Teacher Details assignment feedback using the same top-right alert
  notice pattern as other teacher tabs, including backend error messages when
  assignment submission fails.
- Reorganized the Students table so class, section, stream, and medium render as
  distinct readable columns while phone stacks under the student name and
  session stacks under the class scope to reduce table overflow.
- Added value-based badge colors for Students table stream and medium fields so
  Science/Commerce/Arts and language media are visually distinct.
- Updated the Students filter popover so class options show only class names,
  while section options carry the medium label for clearer section selection.
- Applied the sidebar scrollbar utility to the Students table overflow area and
  added horizontal scrollbar height support so the table scrollbar visually
  matches the navigation scrollbar.
- Added medium display to Student Details header, overview cards, and subject
  selection context chips, plus an in-app Back to Students button for staff
  users to return from details without using the browser back control.
- Moved the Student Details back button to the left of the title and preserved
  Students table context by passing the clicked student/page state into details
  and restoring the table page that contains that student on return.
- Updated DataTable/Students restore behavior so returning from Student Details
  scrolls directly to the clicked student row and briefly highlights it, instead
  of only restoring the page number.
- Matched Student Details header and subject-selection context badge colors to
  the Students table stream, medium, and scope badge palette.
- Updated the existing single-exam marksheet PDF template minimally: embedded
  the school logo on the left, added issued date on the right, changed summary
  order to Total Marks then Marks Obtained, and replaced the signature line with
  the role/school/location text block.
- Moved the Marksheet Templates preview section into a dedicated Reports
  Templates tab,
  showing the active single-exam marksheet layout and a planned final combined
  marksheet overview based on the shared reference images.
- Added report publication dates for approved marksheets: admins set an issue
  date from the Reports Published tab, student/parent result views remain hidden
  until that date is saved and reached, and downloaded PDFs print the saved
  issue date.
- Corrected the report publication migration so `class_id` and `section_id`
  match the existing `INT` primary keys on `classes` and `sections`.
- Broadened marksheet PDF logo lookup across software, website, and backend
  upload asset locations so deployed downloads can embed the school logo.
- Enlarged the single-exam marksheet header logo area and changed the printed
  issue label to `Date` with `DD/MM/YYYY` formatting.
- Increased marksheet header address/date font sizes and rendered the date as
  one line: `Date: DD/MM/YYYY`.
- Rebalanced the single-exam report card header columns and typography so the
  school name, section, report-card title, and exam/class/section metadata have
  clearer alignment and visual hierarchy.
- Adjusted the single-exam report card details table CSS so the manually edited
  three student-information rows render side-by-side in one horizontal band.
- Updated the single-exam report PDF header to show institution name, bracketed
  section, exam name, and Report Card, with a two-row three-column student
  information table.
- Matched the final marksheet back-page summary area closer to the reference:
  a double divider at the marks/criteria boundary and bordered cells for Total
  Marks, Grand Total, Percentage, and Grade.
- Added final marksheet configuration support: exam calculation type
  (`unit_test`, `half_yearly`, `annual`, `mock`, `display_only`), grade
  settings, activity definitions/marks, Activity and Grade Settings admin
  screens, and weighted final marksheet calculations with mock grades.
- Color-coded Grade Settings scale badges so percentage and activity grades are
  visually distinct in the admin list.
- Updated marksheet activities to support subject-like scopes: all classes,
  a specific class, or a specific section, while keeping the separate activity
  grade scale.
- Refined final marksheet layout to match the reference footer/header structure
  and changed guardian-name sourcing to prefer linked father/mother names for
  both single and final marksheets.
- Tightened the final marksheet final-result column and adjusted summary cells
  so Total Marks, Grand Total, Grade, and Percentage keep only the outer side
  borders without internal dividers.
- Made marksheet guardian-name queries schema-aware so deployments without
  `student_parents.father_name` / `mother_name` fall back to parent profile
  names instead of failing.
- Added a default Published Records overview in Reports that lists all approved
  marks grouped by exam, class, section, and subject, with optional filtering
  and one-click loading of the matching marks grid.
- Added loading states to marksheet download buttons in Reports and Student
  Details so users see `Downloading...` while PDFs are being generated.
- Added the first final combined marksheet implementation as a separate PDF
  flow: a two-page front/back landscape template, student-specific subject rows,
  dynamic published-exam columns, aggregate totals/percentage/grade, and download
  actions from Reports Published rows plus Student Details.
- Relaxed staff/admin final marksheet generation so approved marks can be used
  even if publication rows are missing, while student/parent downloads remain
  publication-date gated; improved PDF download error parsing for clearer
  backend messages.
- Simplified the final marksheet PDF styling by removing heavy decorative
  borders, keeping it as a two-page landscape document, and aligning student
  identity rows as class/medium then section/roll number.
- Updated the Reports Templates tab so the final marksheet preview shows the
  two-page front/back layout with cover/co-scholastic content and the marks
  matrix/result side.
- Reworked final marksheet PDF page sizing so the front page does not spill
  into the second page, restored a single clean outer page border, and reduced
  internal line weight to match the referenced layout more closely.
- Adjusted final marksheet borders to follow the reference: one outer page
  border, bordered left/right front panels, single-line attendance row, and
  bordered marks/signature/result sections on the back page.
- Added short-lived in-memory caches to Assign Teacher to Class and Assign
  Subject to Class so switching away and back within the same browser session
  reuses loaded data instead of refetching every time; assignment changes still
  refresh the affected data.
- Added skeleton loading cards and an empty state to the Subjects tab so the
  subject master list has clear feedback while data is loading.
- Expanded the Dashboard with scope-aware analytics: backend summary now returns
  School/Higher Secondary student, fee, payment, and attendance breakdowns, and
  the frontend adds a scope selector with richer class-wise and financial charts.
- Changed the navbar search from global redirect behavior to current-page search:
  the larger search input now broadcasts the query to visible tables, which
  filter current rows and highlight matches with amber badges.
- Added more dashboard chart variety by converting payment collections to an
  area chart and adding an operational balance radar chart for student base,
  attendance, collection, and fee health across School and Higher Secondary.
- Updated teacher assignment details so saved assignment labels now include the
  section medium as class-section (medium)-subject wherever the assignment API
  provides it.
- Updated Exams cards to use colored scope and count badges that match the
  Assign Subject to Class and Student Info badge language.
- Refined the Exams dialog Marks Setup hierarchy with stronger subject labels,
  Biology-only Botany/Zoology branch controls, and clearer marks field labels
  and placeholders.
- Combined the Reports exam section and medium selection into one
  Section (Medium) selector while keeping the selected medium in filter state
  for existing marks/report API calls.
- Fixed HS report student loading by letting the newer
  `student_subject_registrations` subject-choice model take precedence over
  stale legacy `student_exam_subjects` filters in marks and exam report queries.
- Fixed teacher Reports exam selection by returning class-scope metadata from
  teacher-accessible exams and section medium from teacher exam scopes.
- Enabled admin correction of approved marks from the Reports Published tab;
  changed approved rows are saved through the existing backend path and move
  back to draft for review.
- Fixed the Reports Published edit button by preventing the grid auto-load
  effect from resetting edit mode immediately after Edit is clicked.
- Made marksheet activity queries schema-aware so deployments that have not yet
  applied the class/section activity-scope migration fall back to the legacy
  scope-key activity model instead of failing on missing `ma.class_id`.
- Updated the final marksheet PDF Grade Secured In section so activities and
  mock grades render as one list, keeping up to six rows on the left and
  placing additional rows side by side in a second name/grade column.
- Tightened the final marksheet PDF second-page marks table by reducing header
  typography and row padding, making the promotion/final-result columns match
  exam-column width, adding an outer border around the right-side summary block,
  and printing promotion/final totals without decimal places.
- Rebalanced the final marksheet PDF second page after header compaction by
  increasing subject/marks body text, enlarging signature cells, and giving
  remarks cells extra height and left-aligned writing space.
- Adjusted the final marksheet PDF first-page cover panel so the academic year
  and student details stay anchored at the bottom of the right section, and
  changed the photo placeholder from landscape to portrait proportions.
- Anchored the final marksheet PDF second-page signature grid and final-result
  block to the bottom of the page while increasing subject and marks body text
  size further without changing the compact header sizing.
- Added top signing space inside final marksheet PDF signature cells while
  preserving a smaller top padding for remarks cells.
- Centered the final marksheet PDF first-page portrait photo placeholder within
  the open area above the bottom-anchored academic year and student details.
- Updated the Activities page class and section controls to use visible
  checkbox lists for easier class/section selection in both activity
  definitions and activity marks filters.
- Expanded the Activities definition form so class and section checkbox lists
  support multi-selection, creating one scoped activity row per selected class
  or selected section while keeping activity marks entry single-scope.
- Adjusted Activities marks entry inputs to use text fields with numeric input
  mode so marks accept whole numbers without browser number-spinner or
  mouse-wheel value changes while scrolling the grid.
- Changed Activities Max Marks and Order inputs to text fields with numeric
  input modes and sanitizing so mouse-wheel scrolling cannot change values.
- Changed Grade Settings numeric fields to text inputs with whole-number
  sanitizing and rounded existing decimal values for display/editing so
  mouse-wheel scrolling cannot change grade ranges or activity mark values.
- Split approved marks out of the Reports Published tab into a dedicated
  Records tab backed by a per-student approved-records API, showing roll,
  student, class, section, subject, marks, approval status, and single/final
  marksheet downloads.
- Added client-side pagination to the Reports Records tab and rounded displayed
  marks, theory, practical, and total values to whole numbers.
- Added an admin Mark Report tab in Reports that downloads a blank marks
  statement PDF for the selected exam/class/section/subject, with student roll
  numbers and names split into two 20-row side-by-side tables per page and
  empty marks columns for manual entry.
- Fixed final marksheet grade visibility by calculating the final grade from
  the available final percentage even when promotion completeness is not met,
  with a default percentage-grade fallback and cleaner final-result PDF text.
- Refined the final marksheet first-page cover design with a bordered Report
  Card label, larger portrait photo placeholder, and a bordered padded student
  details block moved slightly upward from the bottom.
- Enlarged and lowered the final marksheet first-page photo placeholder to
  better balance the top and bottom spacing in the right-side cover panel.
- Changed the final marksheet second-page exam header marks to show the
  maximum marks for a single subject in that exam instead of the summed exam
  total, while keeping summed totals for percentage calculations.
- Added a Single marksheet only exam treatment that keeps normal/single
  marksheet downloads available while excluding that exam from final marksheet
  tables, totals, signatures, and final-result calculations.
- Fixed Activities edit mode so selecting multiple classes or sections saves
  all selected scopes by updating the current activity row and creating the
  remaining scoped rows.
- Moved activity marks entry out of the Activities setup page into a separate
  Activity Marks page and navigation item under Reports below Exam Report.
- Added a repair migration and backend guard for marksheet activity class
  scopes so multi-class activity creation no longer falls back to the old
  scope-key-only schema that caused duplicate activity-name errors.
- Updated the Activities setup UI to match other admin tabs with a top-right
  Add Activity sheet and a full-width activity definitions list with edit and
  delete actions.
- Changed the Activities add/edit form from a side sheet to a centered dialog
  while preserving the multi-class and multi-section activity controls.
- Adjusted the Activities dialog so class and section selectors appear side by
  side on wider screens with matched scrollable panels, similar to the assign
  teacher dialog layout.
- Updated the Activities dialog action buttons so Create/Update and Cancel
  share the full available width and stack cleanly on small screens.
- Changed Activities max marks entry and display to whole numbers only,
  rounding existing decimal values for edit/list rendering.
- Added colored scope and inactive badges to the Activities list so all-class,
  class, section, grouped-scope, and inactive rows are easier to scan.
- Added success and failure alerts to Activities create, update, and delete
  actions to match the feedback pattern used in other admin tabs.
- Moved the Mark Report statement downloader out of the Reports tab set into a
  standalone Mark Report page and navigation item under Reports below Exam
  Report.
- Updated the Mark Report statement PDF to portrait orientation while keeping
  the 20-row side-by-side split logic, adding class/section/medium header
  details, a bordered Total Marks box, and a subject-teacher signature line.
- Improved the Mark Report statement PDF table readability with larger roll/name
  text and changed pagination to fill the available left column, then right
  column, before moving to the next page.
- Renamed the Mark Report navigation/page labels to Mark Statement while
  keeping the existing route and PDF download behavior.
- Updated Activity Marks entry to round displayed marks to whole numbers,
  show success/failure alerts for load/save actions, add per-cell Empty/Saved/
  Unsaved status badges, and use a stronger green save button style.
- Changed the final marksheet result line to always keep the promoted-class
  wording and show ellipses for missing promoted class or grade values.
- Adjusted the final marksheet second-page marks/signature spacing so the
  signature grid follows the marks table with a small margin, and sparse
  subject lists use taller cells and larger subject/marks text.
- Tightened report visibility so student/parent access cannot see approved
  marksheets before the published date, including Student Details report
  downloads and final marksheet downloads.
- Added a Mark Statement PDF preview panel with a Preview PDF action that
  renders the generated statement below the download controls before saving.
- Re-anchored the final marksheet second-page signature grid to the bottom and
  increased sparse/medium subject row heights to reduce empty space above it.
- Added grade to the single marksheet summary so it now shows Total Marks,
  Marks Obtained, Grade, and Percentage in order.
- Changed the Activities setup list to group matching activity definitions by
  name/settings and show multiple class/section scopes as badges on one row,
  with edit/delete applying to the grouped rows.
- Changed final marksheet signature columns to render exactly one column per
  actual exam instead of always padding the signature grid to six exams.
- Fixed the final marksheet right-side summary block so Grade and Percentage
  span the lower summary row, removing the empty bordered space beneath the
  four summary cells.
- Centered the final marksheet signature remarks cells so they align with the
  other signature fields.
- Centered the co-scholastic Letter Grade and Marks columns on the final
  marksheet front page while leaving Qualitative Value alignment unchanged.
- Updated the final marksheet final-result text so Class X prints
  `FINAL RESULT (UP TO TEST EXAMINATION)` while other classes keep the promoted
  class and grade/distinction wording.
- Hid the Reports Records and Templates sections from teacher logins in the
  internal software app, keeping those admin report sections available only to
  users with marks approval access.
- Updated the mobile Reports tab so teacher/non-admin mark-entry users see only
  Entry, while Published remains available to marks-approval users and Results
  remains the self-view path.
- Added a Total of Unit Test column under Marks Secured In on the final
  marksheet before the final exam column, showing raw 1st/2nd unit-test marks
  while keeping the weighted Unit Test 20% promotion-criteria column separate.
- Adjusted the Class X final marksheet result block so
  `FINAL RESULT (UP TO TEST EXAMINATION)` replaces the result heading and the
  promoted-class statement is omitted only for Class X.
- Updated the Mark Statement PDF title from parenthesized text to an underlined
  `MARKS STATEMENT` heading and widened the roll-number column so the `Roll No`
  header appears fully.
- Changed the final marksheet promotion-criteria 50% column label from Annual
  Exam to Test Exam for Class X only, while preserving the existing annual-style
  calculation bucket for final marks.
- Changed the final marksheet first signature row label from Sign. of Class
  Teacher to Sign. of Administrator.
- Added compact administrator and principal signature images to the final
  marksheet signature grid using `administrator.jpeg` and `principal.jpg` from
  the reports templates folder.
- Added percentage and grade summary cells for the inserted Total of Unit Test
  column on the final marksheet so it matches the other Marks Secured In
  columns.
- Filled final marksheet remarks cells with the qualitative value for each
  individual exam column, derived from that column's total percentage and grade.
- Aligned the final marksheet summary block as two left/right pairs: Total
  Marks with Grand Total, then Grade with Percentage.
- Right-aligned the Grand Total and Percentage cells in the final marksheet
  summary block.
- Moved single marksheet Total Marks and Marks Obtained into the marks table
  footer under the Marks and Marks Obtained columns, while preserving the
  existing Marksheet title and Marks column label.
- Added a Date input to the Mark Statement page and printed it in a bordered
  Date box beside Total Marks on the generated marks statement PDF.
- Moved the Mark Statement PDF Date box to the far right of the page on the
  same line as Total Marks.
- Updated the Mark Statement PDF roster layout so small rosters use one
  full-width Roll No / Student Name / Marks table, while larger rosters keep the
  existing two-table six-column split.
- Changed production auth behavior so every password login requires OTP when
  `NODE_ENV=production`; trusted-device OTP bypass remains available only in
  non-production environments and refresh-token behavior is unchanged.
- Updated the single marksheet table to show nested theory/practical marks for
  split subjects and nested branch/component rows, such as Botany/Zoology with
  their own theory and practical marks, while preserving the existing Marksheet
  title and Marks column label.
