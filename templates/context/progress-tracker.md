# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Existing production project maintenance and feature development.

## Current Goal

- Upgrade messaging into a production-ready text, photo, document, and
  voice system across internal web and mobile while preserving existing
  conversations and backend authorization boundaries.

## Completed

- Added class/section/scope context to the mobile teacher routine `My Periods`
  cards so teacher login can see which class each assigned period belongs to,
  including packed multi-subject routine rows.
- Removed the shared mobile shell subtitle line and the decorative `Overview`
  eyebrow labels from mobile tab hero headers so each screen starts with the
  main header text; added a compact `Marksheet` header to the marksheet entry
  flow with a short subheader without restoring the long explanatory hero.
- Applied the mobile compact workflow UI rule to Teacher Details by replacing
  the tall profile summary with a compact teacher overview, small stat pills,
  icon section tabs, and collapsed attendance filters while preserving teacher
  profile, assignment, attendance, pagination, and password reset logic.
- Reworked the mobile student attendance entry screen to follow the compact
  workflow UI rules used in marksheet: collapsed filters with Apply/Reset,
  a compact overview/status card, a three-action toolbar, and denser student
  roster cards with segmented attendance controls while preserving the existing
  roster, bulk mark, lock, and submit logic.
- Aligned software announcement success/failure feedback with the existing
  software UI pattern by replacing inline page banners with the shared
  top-right alert notice treatment, while keeping contextual form alerts inside
  the announcement dialog.
- Simplified the software announcement create/edit dialog without changing the
  backend workflow: targeting remains a first step, the message step now shows
  only title, urgency, message type, body/template variables, and preview by
  default, while publish/delivery settings and visibility/date controls are
  tucked into compact advanced panels.
- Added reusable announcement holiday names as a separate master list from
  dated `holiday_calendar` records, with backend list/upsert endpoints,
  migration seed values, and software/mobile DLT holiday-variable pickers that
  can select existing names or add a newly typed name for future use.
- Aligned mobile announcement DLT variable handling with software without
  changing the compose flow: mobile now derives fields from each template's
  placeholder schema or placeholder count/content fallback, supports both
  `{#alp#}` and `{#var#}` tokens in previews, and sends explicit variable order
  while the backend dispatcher also resolves named variables by template schema.
- Replaced the shared mobile date selector with a calendar-style picker with
  month navigation, year controls, selected/today states, and safe-area aware
  actions so critical DLT announcement variables and all other mobile date
  fields can be selected without manual date entry.
- Added synthetic Free routine rows from time-slot templates anywhere an empty
  non-break slot exists, so student/teacher/admin routine views can show Free
  periods alongside Break rows; restored mobile teacher routine switching
  between My Periods and assigned Class Routines, with teacher-owned entries
  loaded from the teacher-specific endpoint.
- Allowed standard class routines to save multiple subject/custom entries in
  the same day-period slot while still stripping HS-only applicability fields
  from standard entries; packed HS remains the layout for section/stream
  targeted parallel subjects.
- Fixed class routine duplicate draft creation to use the existing `manual`
  source enum with `parent_version_id` instead of inserting unsupported
  `source='duplicate'`, resolving MySQL data truncation on duplicate copy.
- Fixed class routine duplicate teacher rendering by copying ordered teacher
  assignment metadata from the source routine and preserving copied teacher ids
  in the software slot editor even when the target class assignment lookup does
  not return that teacher.
- Added class routine duplication: admins can copy a selected routine into a
  separate draft for a target session/class/section/medium/stream without
  modifying the published source, with backend draft-only creation, duplicate
  draft protection, HS applicability section remapping, and a software
  Duplicate dialog/action.
- Reworked HS class routine Excel exports into a multi-sheet workbook: a master
  matrix with day/period/time rows and section/stream audience columns, plus
  separate filtered HS audience sheets, while leaving standard school routine
  exports unchanged.
- Changed production auth so `super_admin` and `admin` users must complete OTP
  on every password login, ignoring trusted-device OTP bypass for those
  privileged sessions while preserving configured OTP bypass accounts.
- Linked new message notifications to message ids and added cleanup when a
  message is deleted for self, deleted for everyone, or a conversation is hidden
  for the user; added a migration to clear stale message notifications for
  already-hidden conversations and safely identifiable deleted messages.
- Fixed mobile messaging text wrapping by allowing chat bubbles and preview
  text to shrink/wrap correctly across device widths, and tightened teacher
  messaging visibility so teacher users with a staff role no longer bypass
  scoped visibility; added a migration to remove existing teacher memberships
  from class and section conversations.
- Added class routine Excel export from the software routine download button:
  standard routines export in day-block class timetable format, HS packed
  routines export as period-column grids with subject and teacher names in the
  same wrapped cell, backed by a dependency-free backend XLSX generator and a
  new `/class-routines/:id/xlsx` endpoint.
- Removed Android boot/reboot delivery from the generated Expo Notifications
  receiver and blocked `RECEIVE_BOOT_COMPLETED` in the mobile app config so
  Android 15 builds do not associate boot broadcasts with Expo Audio foreground
  services while preserving push notifications and voice messaging.
- Reworked exam routine navigation in software and mobile into a two-level
  exam-first, class/section-second selector, with scoped previous/next controls
  and full mobile exam routine detail loading instead of limiting results to the
  first eight summaries.
- Made the software class routine hover tooltip scrollable with a constrained
  height so packed routine slots with many entries remain usable.
- Split backend cron execution from the API process by adding a dedicated cron
  worker entrypoint and `worker:cron` script, disabling cron inside the API
  unless `RUN_CRON_IN_API=true`, and adding guarded cron scheduling with
  overlap prevention and duration logging for announcement, messaging cleanup,
  fee reminder, and iClock jobs.
- Added a mobile app-level custom alert provider that intercepts existing
  `Alert.alert` calls and renders them through an in-app modal instead of the
  native system dialog, and strengthened global Inter font application for
  React Native `Text` and `TextInput` at app startup.
- Added exam-level marks entry access policy for mock-style exams: exams can now
  use subject-teacher-only marks entry or class/section-teacher marks entry;
  existing mock exams are migrated to class/section access, backend teacher
  authorization honors the selected policy, and software/mobile exam setup plus
  marks subject filtering are wired to the new policy.
- Added bordered row surfaces and a bordered shadowed tooltip shell to the
  software class routine hover list so packed routine entries no longer appear
  as loose labels.
- Fixed the software class routine slot editor layout by widening the dialog,
  moving scroll behavior into the form body instead of the whole dialog, keeping
  the footer actions in normal fixed dialog flow, and showing colored delete
  icons on subject/custom rows so added rows can be removed or the lone row can
  be cleared.
- Added a mobile Announcements create flow for super admin/announcement
  managers, including a New Announcement action, audience selection, custom or
  registered DLT message mode, category/template selection, publish now/draft/
  schedule options, notification visibility toggles, and backend create/publish
  wiring.
- Reworked the mobile Announcements create UI to match the Messaging compose
  flow: audience cards first, then a second step for message and delivery with
  a selected-audience summary and Change Audience action.
- Enabled deleting selected class routines from the software Class Routine
  section, with backend support for deleting draft or published class routine
  versions and a destructive trash-icon action in the routine header.
- Replaced native browser confirmations in the software Routines page with the
  shared custom AlertDialog for time slot template, class routine, and exam
  routine deletion.
- Changed messaging class/section targets so teachers are no longer included
  through class assignments; teacher message visibility now comes from direct
  conversations and teacher/staff broadcast targets instead of assigned class
  or section groups.
- Added manually controlled messaging reply permissions for class/section
  conversations, including backend conversation flags, software group settings,
  and parent/teacher reply handling; parent and teacher users can now start a
  controlled direct message to admin from mobile/software messaging.
- Fixed the mobile notification unread badge so marking one or all
  notifications as read updates the shared badge count immediately without
  reopening the app.
- Fixed a software Routine runtime error from the teacher split UI by using the
  existing `weekdays` constant instead of an undefined `WEEKDAYS` reference.
- Added routine display titles for real subject rows so entries like Botany or
  Zoology can be saved under the Biology subject for student filtering and marks
  while displaying the split class name in software, mobile, and routine PDFs;
  packed HS Add to slot now also works for custom routine rows.
- Added weekday-based teacher splits to software class routine subject rows so
  one HS hybrid subject can assign different teachers across selected days,
  expanding to the existing per-day routine entries without a backend migration.
- Updated the software class routine slot editor so Custom / Routine-only
  entries support multiple rows like Subject entries, with per-row titles,
  optional teachers, add/delete controls, and one saved custom routine entry per
  row.
- Reworked the mobile Announcements tab into a role-aware module: all users get
  the audience-filtered announcement inbox, while announcement admins/managers
  can also view the queue, registered DLT templates, SMS jobs, and holiday
  records through existing backend announcement endpoints.
- Reordered the parent mobile footer navigation to Students, Messaging,
  Routines, Announcements, and More, and aligned the parent default tab priority
  with that order.
- Changed the mobile Routine class/exam selector to compact horizontally
  scrollable pills shown directly below the filter button row, including the
  currently selected assigned routine/class for teachers.
- Fixed the teacher routine assignment lookup for MySQL strict DISTINCT
  ordering by selecting the class and section names used in the ORDER BY clause.
- Changed mobile teacher routines to use assigned class routine boards instead
  of a separate Teacher View, added teacher-scoped backend endpoints for class
  and exam routines, and enabled the same class/exam switching controls for
  teachers using only their assigned classes.
- Updated teacher mobile footer navigation to show Student Attendance,
  Messages, Routines, Announcements, and More in that order, with teacher
  default tab preference following the same sequence.
- Replaced the shared mobile header's top More icon with a Profile icon that
  switches to the Profile tab and only uses accent color when Profile is active.
- Simplified mobile class routine cards: period number and timings stay on the
  left rail, subject/activity and the entry type badge align across the top row,
  teacher assignment is shown underneath, and class/scope/section/medium text
  was removed from inside each card.
- Changed mobile Routine admin display to show one selected routine group at a
  time for both class and exam routines, with the first matching group selected
  by default and other groups available through a compact horizontal selector.
- Matched mobile Routine admin viewing more closely to software: the compact
  filter toggle now applies to both class and exam routines, exam routines can
  be filtered by scope/class/section/medium, and admin exam results are grouped
  by exam and academic scope instead of a mixed timeline.
- Added admin filters and grouped class routine display to the mobile Routine
  tab: admins can filter the selected day by scope, class, section, and medium,
  and routines render grouped by class/section instead of one mixed timeline.
- Removed Week View and overview metric/date summary cards from the mobile
  Routine tab so routines open directly into the day/teacher/exam list flow.
- Marked Announcement event/holiday date fields as optional in the software
  dialog so normal notices do not look like they require event dates.
- Split the software Announcement dialog into a Messaging-style flow: audience
  picker first, target details second with Change Audience/Continue controls,
  then message/delivery details with the selected audience carried forward.
- Reworked Announcements around custom vs registered DLT messages: custom
  announcements are online-only, registered DLT templates store JSON variable
  metadata, announcement creation renders template-driven variable fields and
  previews, targeting follows the Messaging audience-first pattern, and mobile
  announcement cards/details now label custom vs registered notices.
- Fixed repeated teacher names in Higher Secondary packed routine hover
  displays by deduplicating routine teacher aggregation across applicability
  joins and normalizing comma-separated teacher names before rendering.
- Added Time Slot Template editing and guarded deletion: admins can edit
  template metadata/slots from the Routine Time Slots tab, remove individual
  slots, and delete only unused templates through a backend check that blocks
  deletion while class routines still reference the template.
- Removed Routine Substitutions from the active product scope: software no
  longer shows the Substitutions tab or calls substitution APIs, mobile routine
  views no longer merge/style substitution entries, backend routes/services/
  repositories were removed, admin seeds no longer include the permission, and
  a cleanup migration retires the substitution permission and tables.
- Added explicit class routine layout modes so existing school and normal HS
  routines remain `standard`, while only selected Higher Secondary packed
  routines use `packed_hs` behavior for per-entry medium/section applicability
  and multiple subject rows in the same slot.
- Added staff typing to the teacher-backed staff records used for attendance:
  `teachers.staff_type` now supports teaching and non-teaching staff, existing
  rows default to teaching, staff type is available in teacher APIs, create/edit
  forms, list filters, CSV templates/imports, and non-teaching staff are blocked
  from class-subject assignment while remaining available for attendance.
- Refined the Staff UI by rendering staff type and class scope as badges in
  the list/detail views and removing the separate website staff page entry from
  the software sidebar.
- Reworked the software Messaging new-message dialog to match the mobile
  flow: admins now choose an audience first, select the target details on the
  second screen, and open the chat directly; the regular chat composer creates
  the conversation on the first sent message when no existing thread exists.
- Removed visible Exam Routine versioning from the software UI and PDF output:
  exam routine editing now opens the selected routine directly, selectors no
  longer append version numbers, and user-facing labels no longer call exam
  routines drafts.
- Aligned Exam Routine persistence with class routine's canonical current-row
  behavior: list calls default to current published/draft rows, create/import
  upsert by exam/class scope, draft creation redirects to the same row, and
  updates no longer require a draft-only record.
- Flattened the Exam Routine board so each exam entry renders as one full
  Date/Subject-Time row, preventing subject and time cells from being hidden or
  misaligned by separate nested grids.
- Restyled the Exam Routine board to match the compact class-routine grid
  language with fixed Date/Subject-Time columns, denser rows, smaller
  invigilator text, and horizontal overflow safety.
- Added an Exam Routine selector dropdown beside the routine actions so admins
  can jump directly between exam routines instead of only using previous/next.
- Made Exam Routine section and medium optional so routines can be class-wide
  by default, while still allowing optional section/medium/stream narrowing and
  class-wide subject eligibility.
- Added per-row removal to the Exam Routine add/edit dialog while preserving at
  least one editable exam row.
- Made the class routine slot editor dialog scrollable with sticky actions so
  multiple subject rows can be edited without losing access to Save or Cancel.
- Kept class routine cells compact when multiple subjects share one slot by
  rendering one visible block with a `+N` marker and showing the full subject
  list on hover/focus.
- Updated class routine timetable headers and PDFs to display time-slot
  template labels first, so breaks can occupy internal slot order without
  shifting visible academic period names.
- Synced the Routine Day view with canonical current class routines by making
  the board choose one published-first/draft-fallback routine per class scope,
  so it still displays all classes for the selected day without showing stale
  duplicate rows.
- Replaced class routine draft reuse with a canonical routine lookup so editing
  a published routine writes through the current class-scope row instead of
  creating or reusing separate draft copies.
- Removed version creation from normal class routine operations: create/import
  now upsert the canonical class routine for the class scope, slot/full updates
  write to that canonical row directly, draft creation is a no-op redirect, and
  publishing a stale draft merges it back into the published routine.
- Made the class routine list default to canonical Current routines only, with
  an explicit All versions filter for old duplicate rows, matching the Day
  board's published-first/draft-fallback selection.
- Added routine-level exam scope support with a migration for
  `exam_routine_versions` scope/class/section/medium/stream, backend
  create/update/import handling, scoped publish archiving, and a Scope -> Exam
  -> Class -> Section creation flow in the software Exam Routine dialog.
- Scoped the Exam Routine dialog's exam selector so it requests exams from the
  server by selected class scope and hides exams that do not match that scope.
- Scoped Exam Routine subject choices to the selected exam and selected
  class/section/stream offerings, with backend validation rejecting subjects
  outside the exam or class scope.
- Allowed Exam Routine subject scope checks to use both active
  `subject_offerings` and legacy `class_subjects`, keeping the UI options and
  backend validator consistent on servers with mixed subject-assignment data.
- Added routine-only custom class routine slots so admins can place timetable
  labels such as English Dictation without creating formal marks subjects:
  custom slots require a title, may optionally select any teacher, skip
  subject-assignment validation, and still participate in teacher conflict
  checks when a teacher is selected.
- Removed the overview metric card section from the software Announcements page
  so the management filters, creation action, and tabs start directly below
  page notices.
- Aligned the software Announcements page with internal UI standards by moving
  page actions into `TopBar`, putting filters in a compact popover, switching
  tabs to the line variant, tightening dialog scroll/footer treatment, and
  using neutral dark-mode-safe row surfaces.
- Updated software Announcements feedback alerts so draft saves, scheduled
  saves, draft-version creation, publish, template import, SMS dispatch, and
  failures show specific titles and messages instead of the old generic
  Updated/Action failed text.
- Added durable class display ordering with a migration-backed
  `classes.display_order`, Roman numeral backfill defaults, Classes create/edit
  controls for the order value, academic API exposure, and Routine day-board
  sorting by display order instead of alphabetical class name.
- Documented the planned Routine and Announcements modules in requirements,
  project overview, and architecture context: class/exam routine versioning,
  breaks, teacher conflict rules, role-specific views, DLT-based
  offline SMS announcements, holiday calendar records, and mobile/software
  navigation expectations.
- Added initial database migrations for Routine and Announcements schemas:
  time-slot templates, class routine versions/entries/teachers, exam routine
  versions/entries/invigilators, routine substitution tables later retired,
  announcement
  categories, DLT SMS templates, announcement targets/attachments, SMS jobs and
  recipients, holiday calendar records, and role permission seeds.
- Added the initial backend Routine module with protected routes, controllers,
  services, repositories, and PDF generation for time-slot templates, class
  routine draft/publish/version reads, exam routines linked to existing exams,
  effective class routine reads, student-scoped routine reads,
  and teacher own-routine reads.
- Added the initial internal software Routine page and API wrapper, with a new
  Routine sidebar section, tabs for Class Routine, Exam Routine,
  and Time Slots, plus draft creation, publish actions,
  filtering, and routine PDF downloads wired to the backend.
- Applied the Routine schema migration locally and adjusted the
  `class_routine_versions.stream_id` foreign key to avoid MySQL rejecting
  `ON DELETE SET NULL` on a column used by the generated stream dedupe column.
- Clarified the software Reports Published tab by moving the marksheet
  publication panel above the approved-student grid filters and labeling
  subject/student filters as view-only helpers, so publishing no longer appears
  tied to loading student rows.
- Filtered the Reports pending-review queue by the same current subject
  eligibility rules used by the marks grid, so stale pending marks for students
  no longer assigned to an elective/optional subject do not appear as
  un-loadable review groups.
- Refined mobile Student Details layout by wrapping identity badges, compacting
  stacked summary cards, replacing horizontal tab scrolling with a wrapping tab
  grid, and applying the same wrapping chip-grid pattern to exam selection and
  Exams setup session/class/section choices.
- Renamed the mobile Reports-facing labels to Marksheet in the app shell, More
  screen, Reports screen title, and Student Details report tab while keeping
  internal route keys unchanged.
- Replaced the Student Details selected-exam marks display on software and
  mobile with a marksheet-style preview card before download, preserving the
  existing report loading and PDF download behavior.
- Fixed parent marksheet access when a parent's phone number also matches a
  student profile by prioritizing parent-linked student ownership before
  student-only result restrictions.
- Renamed Student Details marksheet preview columns on software and mobile from
  Max Marks/Marks to Total Marks/Marks Obtained.
- Added a download icon to the mobile Student Details Download Marksheet button
  while preserving the existing download behavior.
- Replaced the software Reports Templates tab with a Draft tab that filters the
  shared marks grid to saved draft entries and keeps the existing save/submit
  draft workflow available.
- Aligned the Reports overview pending count with the Auto Review pending queue
  by counting only currently actionable pending review scopes.
- Reworked the mobile Messaging new-conversation flow from a bottom modal into
  a guided full-screen audience and target selection experience, preserving the
  existing chat composer features and adding custom conversation names for
  class, section, and broadcast/group targets.
- Promoted the mobile Messaging new-conversation selector into a real
  React Navigation screen (`MessagingCompose`) that returns the selected target
  to the Messaging tab instead of rendering as an in-tab overlay.
- Refined the mobile Messaging conversation screen with a cleaner top chat bar,
  full-height message list, clearer incoming/outgoing bubbles, visible
  per-message action buttons, and a tighter bottom composer.
- Made the mobile Messaging message action dialog cancelable so Android users
  can dismiss it by tapping outside as well as using Cancel.
- Wrapped the mobile Messaging new-conversation screens in a keyboard-avoiding
  safe-area aware view so target search and group-name inputs remain usable
  while typing.
- Fixed mobile Messaging voice playback replay by rewinding voice attachments
  and unsent voice previews to the start when playback has already reached the
  end.
- Made Messaging read-only for parent and teacher roles by revoking
  `messages.send` from those role defaults, adding a production migration to
  remove existing send grants, enforcing the restriction in backend
  send/edit/typing paths, and hiding reply/forward/composer controls on web
  and mobile.
- Restyled the mobile Messaging conversation composer to follow the attached
  rounded chat-input reference while preserving current text, image, document,
  voice-recording, reply, edit, and send behavior.
- Added conversation-level delete-for-me in Messaging by storing per-member
  hidden timestamps, filtering hidden chats from lists and unread counts,
  restoring hidden chats when a new message arrives, and exposing delete
  controls in mobile and software chat lists.
- Updated the mobile Messaging conversation list header to a WhatsApp-inspired
  title, action-icon, rounded-search, and filter-chip layout, grouping loaded
  chats by All, Unread, One-to-One, Parents, Teachers, Classes, Sections, and
  Broadcasts without changing backend recipient rules.
- Refined the mobile Messaging list rows to match the WhatsApp-style reference
  with flat divider rows, larger list avatars, last-message times, compact row
  metadata, safe-area/keyboard-aware wrappers, and a smaller sent voice-note UI.
- Tuned the mobile Messaging list back toward the app's compact patterns with a
  smaller header/search/filter layout, date-time under each chat name, restored
  row name sizing, selection coloring, and multi-select delete from the top bar
  instead of per-row delete buttons.
- Switched the shared mobile accent theme from slate/green to the software
  primary red (`#da271f`) for primary and success accent tokens, kept the user's
  Messaging top padding, rounded the new-conversation icon, and added a border
  to the message composer input tray.
- Changed mobile Messaging voice notes from bordered attachment cards to
  WhatsApp-style inline waveform strips inside the existing message bubble,
  keeping play/pause and speed controls while removing the bulky visible box.
- Increased mobile Messaging chat message and conversation preview font weight
  for stronger readability.
- Added multi-select forwarding in mobile Messaging, removed forward/send
  success and failure dialogs, and replaced textual sent/delivered/read status
  labels in message bubbles with tick/error icons.
- Reduced mobile Messaging photo/document bubble padding so media sits closer
  to the chat bubble edge, captions stay inset, and document attachments render
  as compact inline rows instead of nested cards.
- Made mobile Messaging avatars neutral by replacing accent-colored initials
  backgrounds with muted surfaces and adding a subtle border around avatar
  circles.
- Added an in-app mobile Messaging photo preview screen so tapped chat photos
  open inside the app, and darkened generated avatar initials backgrounds while
  preserving the subtle avatar border.
- Added pinch, pan, and double-tap zoom controls to the mobile Messaging
  in-app photo preview screen.
- Changed mobile Messaging chat bubbles from accent/bordered styling to dark
  neutral fills with bright message, metadata, status, voice, and document text.
- Updated mobile Messaging outgoing chat status and failed-send icons to use
  the app accent color inside dark chat bubbles.
- Matched mobile Messaging dark-mode chat bubble colors by using a shared dark
  neutral fill for sent and received bubbles while keeping bright text and
  accent status icons.
- Updated the notification direction in project context: notifications are now
  scoped to high-value message, attendance, marksheet, fee, account, and system
  events; push delivery is permission-gated separately from inbox access.
- Added a notification migration for `category`, `action_url`, and `deep_link`,
  plus `notifications.push.receive`, `notifications.manage`, and
  `notifications.send` permissions with role defaults.
- Standardized notification creation through the shared notification service,
  added category/deep-link normalization, gated push-device registration and
  dispatch by `notifications.push.receive`, suppressed duplicate message
  notifications for attendance absence notices, removed the old attendance
  direct notification insert helper, and disabled the stale fee reminder job
  that targeted student IDs instead of user IDs.
- Refined the software Notifications page with category filters, category
  badges, filtered unread counts, and action links for notification records
  that provide an action URL.
- Added a mobile Notifications inbox screen, mobile notification API service,
  header unread badge, and More-menu entry for users with `notifications.view`.
- Rounded the main mobile app header icon buttons to circular controls while
  preserving the existing theme and header actions.
- Added an unread-message badge to the mobile footer Messaging icon using the
  existing `/messages/unread/count` API.
- Installed and configured `expo-notifications`, added mobile push
  registration/unregistration helpers, prompt-and-register behavior after
  sign-in for users with `notifications.push.receive`, and a Profile toggle
  for enabling or disabling push delivery per device.
- Expanded default notification inbox and push receive permissions to every
  role while keeping notification visibility scoped to the logged-in user's
  own notification records.
- Redesigned the mobile Dashboard tab using the attached compact dashboard as
  visual and UX inspiration: scope pills, Overview/Attendance/Finance/Classes
  panes, dense KPI tiles, divider lists, compact progress bars, and existing
  dashboard summary data without changing backend behavior.
- Refined the mobile Dashboard against the latest dark-mode screenshot by
  moving dashboard title/actions into the dashboard content instead of using
  the global app header, tightening the top controls/cards/lists, adding a
  recent-message View all action, and restyling the bottom footer as a compact
  rounded dock with active accent icons.
- Added bordered visual chart panels to the mobile Dashboard Attendance,
  Finance, and Classes panes, including attendance snapshot chips, stacked
  attendance status meter, collection graph, and largest-class bar chart built
  from the existing dashboard summary API.
- Redesigned the mobile More screen as a modules hub inspired by the supplied
  reference: compact Modules header, searchable module list, frequently used
  tiles, expandable category cards, and a recent-module strip while preserving
  existing role/permission visibility and navigation behavior.
- Added an authenticated mobile app-update policy endpoint, automatic
  app-start update prompts, Profile update checking/opening controls, and a
  super-admin notification action for announcing available mobile updates via
  the existing notification/push pipeline.
- Moved mobile app update policy management into the database with a new
  software Settings > App Updates panel for Android/iOS latest version,
  minimum supported version, build numbers, store URLs, prompt text, active
  state, and update notifications, removing the need to edit backend env values
  for normal release announcements.
- Removed placeholder text from mobile and software login/OTP inputs while
  preserving labels, validation, and authentication behavior.
- Made auth refresh sessions role-aware: super admin and admin refresh tokens
  and database sessions now expire after 1 day by default, while other roles
  expire after 30 days by default; refresh now rejects expired DB sessions.
- Updated the Payments Record Payment dialog so the student selector shows
  student name, roll number, and guardian name, truncating long values with
  ellipses and allowing search by those fields.
- Added a separate `admin` role that receives all current permissions except
  `dashboard.view`, exposed it in internal web user creation/filtering, and
  routed admin logins away from the dashboard by default.
- Added status-only fee item support for cases like exam or registration fees:
  fee setup can mark a fee item as Amount Based or Status Only, generated
  student fee rows preserve that mode, status-only rows show paid/pending
  without amounts, and Record Payment marks them paid without entering an
  amount.
- Kept zero-amount fee items visible in student fee options so newly created
  fee names appear in Student Details and payment due selectors before the
  amount is finalized.
- Refined the internal web Payments table to match the Students table style:
  grouped student/class/section cells, section-medium display, scope under
  class, roll under section, and colored Fee Name badges backed by `fee_name`.
- Simplified mobile Student Details fee presentation by removing overview
  Outstanding/Paid Total cards and reducing the Fee Summary section to title,
  payment coverage, and errors only.
- Updated Student Details fee displays on web and mobile so pending fees and
  payment history show a user-facing Fee Name, using the named fee item where
  present and falling back to Admission Fee for admission rows; payment and
  fee-option APIs now expose an explicit `fee_name` field for this display.
- Generalized Fee Setup installment wording to fee types/items, made fee item
  amount optional for create and update by storing blank amounts as zero, and
  aligned unpaid student ledger sync with zero-amount updates.
- Fixed transportation fee duplicate due rendering caused by repeated
  student-level transportation saves: unchanged active assignments now reuse the
  existing assignment, and transportation due lists exclude inactive assignment
  dues by default while preserving payment history.
- Added explicit marks entry statuses for Present, Absent, and Pending:
  blank saved marks now remain pending until reviewed, absent rows store blank
  marks but calculate as zero, pending rows are blocked from submit/approval,
  and single/final marksheets display absent marks as `AB`.
- Updated the mobile Reports and Student Details result UI for the same marks
  status workflow, including mobile Present/Absent/Pending row controls,
  Mark Blank Absent, disabled absent/pending mark entry, and `AB` result
  display.
- Restricted student attendance approved/history access for teacher-only
  logins so teachers only receive and open attendance sessions they submitted,
  and clarified the mobile teacher labels as My Approved Attendance and My
  Attendance History.
- Added paginated row views to the student attendance Review and Notify
  session lists in both internal software and mobile so large attendance
  batches are easier to scan.
- Updated marks entry status controls so the software status select is colored
  by Present/Absent/Pending and the mobile status chips stay side by side.
- Redesigned the mobile Reports marks cards to follow
  `frontend/mobile/design.md`: student name, roll, class/section-medium,
  subject, mark status, attendance status, centered score, and download action.
- Corrected marks entry fallback status to Present and matched the mobile
  Reports marks input and Download button height in the card footer.
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
- Fixed payment CSV bulk upload header handling so descriptive required/
  optional header labels from older templates still map to the expected
  fields, and updated the downloaded payment upload format to use exact
  import headers.
- Added theory/practical/total split mark display in final marksheet
  exam cells when a subject has component marks, matching the
  `marksheet.md` Computer example.
- Fixed report and mark statement native dropdown styling so select
  controls and options use dark-mode-safe background and text colors.
- Updated single and final marksheet summary rows so Grand Total shows
  the obtained marks with the explicit out-of max marks text from
  `marksheet.md`.
- Adjusted the single marksheet split subject layout so Theory,
  Practical, and Total appear inside the Marks Obtained column while
  the Subject column stays on one subject row, matching `marksheet.md`.
- Merged Botany and Zoology in the single marksheet PDF display into one
  Biology row with summed theory, practical, total, and max marks.
- Added independent Single Total vs Theory + Practical setup and marks
  entry for Botany/Zoology Biology branches, and updated marksheet
  aggregation so single branch totals roll into the Biology theory line.
- Aligned single marksheet subject ordering with final marksheet order:
  compulsory subjects first, then elective, then optional, with subject
  group fallback from current class subject assignments for older exams.
- Filtered the Reports subject dropdown by selected exam, class, and
  section using active subject offerings so large subject lists only show
  relevant subjects for the selected marks entry scope.
- Added marksheet language-priority sorting inside each subject group:
  English/English I/English II first, then Assamese, Hindi, MIL Hindi,
  MIL Bengali, MIL Assamese, followed by other subjects alphabetically.
- Added a manual pending Review tab in Reports beside the existing
  Auto Review queue so admins can select exam/class/section/subject and
  load pending marks without automatic queue navigation.
- Added a filtered/all student CSV export in the Students tab using the
  same columns as the student bulk-entry CSV, including parent and photo
  fields where available.

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
- Fixed student edit stream updates by making backend enrollment updates prefer
  newly submitted stream values over the existing `stream_id`, and by loading
  real stream records in the Students edit dialog instead of using hard-coded
  stream options.
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
- Added the first Transportation Fee implementation unit: route and pickup-point
  setup, per-student monthly transport assignments with start-month due
  generation, month-wise transport dues, multi-month transport payments,
  separate transport receipt PDFs, and an internal web Transportation Fee page
  under the Student fee navigation.
- Updated the Transportation Fee page visual language with colored stat cards
  and dark-mode-safe transport type, status, amount, and receipt badges to
  match the newer academic/admin page styling.
- Revised Transportation Fee from route/pickup-point assignment to a practical
  student-specific monthly fee model: assign students by session/class/section/
  medium/stream filters, set start month/year and monthly fee directly, and
  manage the same enable/disable workflow from Student Details.
- Moved the mobile teacher details experience out of the Teachers tab inline
  detail state into a dedicated `TeacherDetails` navigation screen while
  reusing the existing `TeacherDetailsModule` content and preserving teacher
  list, assignment, edit, delete, and messaging actions.
- Aligned the mobile attendance module with the software Student Attendance
  workflow by making `Student Attendance` an explicit tab, keeping it wired to
  the existing `/attendance/students/*` backend APIs, and matching the
  load-students, mark-all-present, mark-all-absent, and submit controls.
- Replaced the mobile More popup with a dedicated `More` navigation screen
  that keeps the existing grid module launcher but groups visible modules into
  software-style sections such as Student, Fee, Staff, Utilities, Reports, and
  Settings.
- Split mobile Teacher Attendance into its own module tab wired to the existing
  backend teacher attendance APIs and PDF download flow, removed teacher logs
  from the Student Attendance module, and placed Teacher Attendance under Staff
  in the mobile More screen.
- Updated the mobile Payments tab with the software payment serial behavior:
  payment cards now show `Sl. No.` using `receipt_serial` with a fallback serial,
  receipt sharing uses that serial label, and Higher Secondary payment filters
  and record-payment student loading now include stream selection without adding
  CSV export or bulk upload controls to mobile.
- Updated the mobile Student Details Parents tab so parent phone edits are
  constrained to the 10-digit format expected by the software/backend validation
  and valid parent email rows can be tapped to open the device email app.
- Added a top-level mobile Transportation Fee tab under the Fee section,
  matching the software workflow with live transport summary cards, assignment
  creation, pending dues, payment recording, receipt sharing, payment edit/delete,
  and backend wiring through the existing transport fee APIs.
- Added a top-level mobile Activities tab under Academics, wired to the
  marksheet activities backend so users can view grouped activity definitions
  and create, edit, activate/deactivate, scope, or delete activity rows similar
  to the software Activities page.
- Added fee payment receipt download/share actions inside Student Details on
  both software and mobile, so regular fee receipts are available from each
  payment-history row alongside the existing transportation receipt downloads.
- Restored the Student Details Transportation tab for parent users in both
  software and mobile while keeping Subject Selection read-only for parents,
  and made transportation assignment/due loading independent from restricted
  payment-history access.
- Allowed the read-only student subject-registration endpoint to be used from
  parent Student Details via `student.view`, with backend parent-student
  ownership scoping so parents can see only their assigned students' subjects.
- Changed auto-created parent login accounts to use `123456` as the default
  password whenever a new parent user is created from student creation or
  Student Details parent phone updates.
- Locked submitted marks in teacher entry workflows on software and mobile:
  only draft rows can be edited, selected, saved, or submitted, and the backend
  now rejects no-op submit/approve/reject actions instead of returning a
  misleading success.
- Treated legacy `@placeholder.local` parent emails as empty in the students
  backend, hid them from student list/detail responses, and allowed Student
  Details parent email edits to clear both `parents.email` and linked
  `users.email`.
- Added scoped mobile messaging broadcasts for `All Parents`, allowing admins to
  choose All, School, or College parents, with backend recipient filtering based
  on active student enrollment class scope.
- Changed OTP auth so non-production logins do not require OTP, and guarded the
  Fast2SMS sender so SMS is skipped outside `NODE_ENV=production` unless
  `SMS_ALLOW_NON_PRODUCTION=true` is explicitly set.
- Updated Student Details marksheet exam lists on software and mobile to use a
  student-specific approved-exam source for admin users and display exams in
  ascending entry order instead of latest-first.
- Fixed production OTP trusted-device behavior so verifying OTP stores the
  device in production too, and later logins from the same mobile device do not
  resend OTP just because the app was updated or the session expired.
- Removed grand total, percentage, and subject count from the mobile Student
  Details marksheet preview while leaving the downloadable marksheet unchanged.
- Removed parent class/section columns from the software Users directory and
  updated shared DataTable pagination controls to use dark-mode-safe colors.
- Increased the Users API pagination limit cap from 50 to 100 so the software
  Users table keeps the selected 100-row page size.
- Added exact-match OTP bypass environment settings for dedicated app-review
  accounts, preventing Play Store/App Store test-device logins from sending OTP
  to real admin phones while keeping OTP active for normal production users.
- Restored grand total and percentage in the mobile Student Details marksheet
  preview and replaced subject count with grade, without extra seal/school-name
  or signature placeholders.
- Fixed a mobile Messaging race where opening a new class/group conversation
  could be overwritten by the conversation list auto-selecting the first chat.
- Tightened Messaging visibility for parent and teacher logins by filtering
  conversation lists, unread counts, message reads, deletes, reports, searches,
  typing reads, and media access through role-specific eligibility: teachers
  see direct chats plus assigned class/section and teacher-audience broadcasts,
  while parents see direct chats plus conversations tied to their active
  children's class/section or parent-audience broadcasts; read-only clients no
  longer fetch recipient target directories.
- Added rounded bordered controls to mobile Messaging conversation delete/search
  actions and padded the in-conversation search input for clearer touch targets.
- Matched mobile Student Details tab chips to the Messaging filter badge style
  with soft accent active backgrounds, accent borders, and accent text.
- Simplified the mobile More screen by removing accordion category cards,
  frequent tiles, and recent tiles in favor of grouped module lists with small
  uppercase section headers.
- Refreshed the mobile Student Details overview using the supplied layout as
  inspiration: profile title row, larger identity card, four metric tiles,
  icon-led tab chips, and icon-led student information rows while retaining the
  app theme colors.
- Corrected the mobile Student Details refresh by removing the duplicated
  header, Active badge, Fee Status, and Approved Days overview tiles, and
  returning typography and avatar sizing to the app's compact scale.
- Extended the compact icon-led Student Details hierarchy across Parents,
  Subject Selection, Attendance, Fees & Payments, Transportation, and Marksheet
  tabs without changing the underlying tab behavior.
- Added a subtle themed border to the mobile Student Details avatar and gave
  top identity badges distinct gender, scope, and stream colors.
- Updated the main mobile Students list cards using the supplied student-info
  reference for badge styling and class/section presentation, while keeping the
  existing project theme colors and avoiding the reference reports CTA.
- Refined the main mobile Students list cards by removing the class/section
  icon, changing badges to `Roll No -` and `Medium -` wording, and applying the
  app accent treatment to avatars and the filter button.
- Refreshed the mobile Profile screen using the supplied reference as design
  direction: compact accent avatar header, role badges, and icon-led account
  information rows while preserving the existing font scale.
- Corrected the mobile Profile overview hierarchy by removing the Overview
  eyebrow, reducing the My Profile label, and making the account name the
  primary text without touching other profile sections.
- Fixed the software Messaging new-message target screen so its selector content
  scrolls inside the dialog while the action footer remains visible.
- Updated Messaging staff targeting to use scope plus staff type: all-staff
  broadcasts now support school/college and teaching/non-teaching filters, and
  one-staff selection can be narrowed by the same dimensions.
- Added a mobile Messaging conversation details screen opened from a group chat
  header, allowing saved class/section/broadcast conversation names to be
  edited after the chat has started.
- Improved class routine publish conflict errors so teacher time conflicts now
  include the teacher, day/time, and conflicting class/section instead of only
  the generic publish failure text.
- Refined class routine conflict details to show readable weekday labels and
  both the selected period/time and the conflicting period/time.
- Reworded class routine teacher conflict errors into a readable multi-line
  scheduling-conflict format with AM/PM slot times.
- Reordered the mobile dashboard-style bottom navigation to Dashboard,
  Messaging, Routine, Announcements, and More.
- Fixed the mobile bottom navigation layout so five items fit evenly and the
  More icon remains visible.
- Wired the mobile Routine tab to the published class-routine board endpoint so
  admin/staff routine viewers see the software-published week/day routines, and
  aligned mobile weekday handling with the backend's full Monday-Sunday range.
- Added bulk-day editing to the software class routine slot dialog: users can
  select multiple days for one period, add multiple subject rows once, and save
  the same slot entries across all selected days.
- Added Replace/Add save modes to the software class routine slot dialog so HS
  parallel subjects can be appended to existing selected-day slots without
  rewriting the common subjects.
- Added HS stream-level class routine support: class routine versions can omit
  section/medium, routine entries can target a medium and selected sections,
  student routines filter by entry applicability and selected subjects, and the
  software slot dialog exposes per-subject medium/section applicability.
- Updated the HS routine migration to replace the old one-entry-per-period
  unique key with a normal period index so parallel subject rows can coexist in
  the same slot.
- Updated the mobile class routine view to render routine slots by label instead
  of fallback serial numbers, show break slots, group packed HS subjects under a
  single period label, and highlight entries assigned to the logged-in teacher
  using teacher user IDs exposed by the routine board payload.
- Simplified the mobile exam routine row layout to show the exam number on the
  left with subject, date, and time stacked in the card, and switched mobile
  routine times from 24-hour format to 12-hour AM/PM format.
- Fixed mobile class routine break detection to honor time-slot default break
  metadata, so break rows show the Break text, time range, and period metadata.
- Fixed class routine payload timing to fall back to linked time-slot template
  start/end values when an entry does not store its own times, allowing mobile
  break rows to show the actual break time.
- Added synthetic break-slot rows to class routine board/detail responses when
  a time-slot template has a break period but no saved routine entry, so mobile
  shows breaks such as Period 5 between surrounding class periods.
- Updated mobile routine period labels to count only class slots, so break rows
  display as Break and the next teaching period continues with the next number.
- Applied the same break-aware display numbering in the software class routine
  week/day boards and slot editor description, keeping raw period numbers only
  for internal save/edit operations.
- Removed the mobile announcements inbox overview cards for Visible and Urgent,
  leaving the filter chips and announcement list as the first visible content.
- Matched the mobile Announcements header and filter chips to the Messaging
  screen pattern with a compact title/action row, refresh icon, New action, and
  soft bordered active filter chips.
- Switched the mobile Dashboard tab to use the shared AppShell header used by
  other tabs and removed its duplicate private dashboard header/actions.
- Added top padding to the mobile Dashboard content now that it sits below the
  shared AppShell header.
- Made the automatic mobile app update prompt one-shot per platform/version/build
  by storing the last prompted update key locally, while keeping manual update
  checks in Profile able to show the prompt on demand.
- Simplified mobile Announcements for parent/teacher roles to an inbox-only
  view: no Queue, DLT, SMS, Holidays tab, compose/publish actions, or
  urgent/holiday filters even if broad announcement permissions are present.
- Fixed parent/student HS class routine lookup so packed HS routines with no
  stream-specific version can still match students who have a stream assigned,
  mirroring the existing packed HS section/medium fallback behavior.
- Tightened class routine teacher conflict diagnostics: the validator now
  compares effective entry/template slot times and reports both the publishing
  class/period/time and the already-published conflicting class/period/time.
- Fixed the software routine slot teacher-split save flow so multi-teacher,
  multi-day slots require explicit days per teacher instead of treating blank
  teacher day chips as all days, preventing accidental HS Friday/Saturday
  teacher assignments during hybrid routine edits.
- Restricted mobile messaging group details/settings access: parent and teacher
  users can no longer open the group settings page from the chat header, and the
  details screen now shows an access-restricted state if reached from stale
  navigation.
- Fixed mobile routine entry badges so only true empty slots display Free;
  activity rows now display Activity and custom subject rows are not muted as
  free periods.
- Added exam routine duplication: software now exposes a Duplicate action for
  selected draft/published exam routines, and the backend creates a separate
  draft copy for the selected target exam/class scope without changing the
  source routine.
- Updated the software class routine header so long selected routine names can
  wrap normally and the controls/actions sit on a dedicated second row.
- Added combined-class grouping for class routine slots: class routine entries
  now support an optional `combined_group_key`, the software slot editor can set
  it, duplication preserves it, and teacher conflict validation ignores
  same-teacher overlaps only when both entries share the same non-empty group
  key. Added migration `20260811_class_routine_combined_group.sql`.
- Refined the software class routine header again so the title/summary is a
  normal full-width text block and the navigation/actions row is aligned to the
  right.
- Applied the same software header pattern to exam routines: wrapping
  title/subtitle and summary first, with exam/class navigation and actions
  right-aligned below.
- Restored the software routine header flex layout while keeping the header text
  wrappers free of `flex-1`, so actions remain on the right without forcing the
  title block to flex-grow.
- Updated routine software icon-only delete controls to use a visible bordered
  destructive background treatment across routine, slot, teacher split, exam
  row, and time slot dialogs.
- Changed the software exam routine header to match the class routine header
  pattern, using exam/class dropdown selectors with right-aligned actions
  instead of scrollable pill selectors.
- Split the software exam routine header into two rows: title/summary on the
  first row and routine navigation, dropdown selectors, and actions on the
  second row.
- Removed the forced filled background from the mobile shared header
  notification and dark-mode icon buttons while keeping the profile active
  state unchanged.
- Reordered the mobile teacher portal footer to Teacher Info, Marksheet,
  Messages, Routines, Announcements, and More, and allowed teacher-role users
  to see their Teacher Info tab without requiring the broader teacher view
  permission.
- Moved the software exam routine previous/next sliding arrows from the second
  controls row back into the top header title row to match the class routine
  header pattern.
- Simplified the software class routine edit slot dialog styling: grouped slot
  settings into one soft panel, reduced repeated borders on subject/custom
  rows, and added clearer section headings and selected-state color hierarchy.
- Restored important separation borders in the software routine edit dialog for
  subject/custom row cards, teacher split blocks, and packed HS section
  selection panels while keeping the rest of the dialog lighter.
- Fixed software routine edit slot reopening for teacher splits by inferring
  saved teacher/day selections from matching routine entries in the same period,
  so split weekday chips reappear instead of being reset to blank.
- Changed the software class routine header to match the exam routine two-row
  layout: title and summary on the first row, with view selector, routine/day
  dropdowns, import, duplicate, download, and delete controls on the second row.
- Improved software routine conflict alert readability by rendering multiple
  teacher scheduling conflicts as a bulleted list while leaving single routine
  errors as normal text.
- Made class routine publish assignment validation specific: missing teacher
  assignment errors now include teacher, subject, class/section/medium, weekday,
  period, and time, and the software alert can render multiple missing
  assignments as a list.
- Fixed mobile messaging group setup/settings gating: super admin role checks
  now tolerate role formatting variants, and dynamic backend broadcast target
  keys are treated as group targets so the conversation name field appears.
- Fixed mobile messaging and announcement portal issues: chat bubbles now wrap
  long text without Samsung Fold clipping, shared header text is constrained
  beside action icons, super admin role checks are normalized across mobile
  shell/messaging/announcements and backend RBAC, student users can receive
  class/section/scope mobile announcements, and common bottom sheets have extra
  bottom clearance for Android navigation-button mode.
- Fixed mobile messaging group rename for super admin/admin managers by removing
  the extra conversation-membership visibility check from the backend rename
  service after the manage permission check.
- Completed super admin messaging permission normalization across mobile and
  backend checks by treating both `super_admin` and `superadmin` as the same
  role in RBAC, messaging services, messaging SQL role lookups, announcement
  management gates, shell navigation, student/teacher message entry points, and
  push registration.
- Fixed announcement mobile inbox and push delivery: removed the invalid
  `students.user_id` announcement audience branch because students are resolved
  through parent-linked enrollments in this schema, removed the
  `notifications.push.receive` gate from device registration and push dispatch,
  and allowed authenticated mobile users to register for push notifications.
- Upgraded the mobile announcement composer DLT flow to match the software
  module more closely: registered templates now show template content, typed
  variable fields, date pickers for date variables, holiday suggestion chips for
  holiday variables, rendered preview, SMS send time, and optional event/end/
  reopen date fields.
- Added `provider_template_id` to announcement SMS templates for Fast2SMS
  Message IDs, wired template create/update/import/list flows in backend,
  software, and mobile, and changed Fast2SMS DLT dispatch to send the provider
  Message ID while preserving the official DLT Template ID.
- Redesigned the mobile Teacher Portal marksheet entry screen around a compact
  workflow: collapsed filters behind a filter button, kept bulk actions to
  Filters/Select All/Submit All, replaced large summary cards with a compact
  overview, and moved save/submit into each student card while preserving the
  existing marks, attendance, selection, and submit APIs.
- Promoted the mobile compact workflow layout into the shared UI rules:
  repeated-work mobile screens should use the existing shell header,
  compact overview, compact toolbar, collapsible filters, dense record
  cards with local actions, and the existing bottom navigation.
- Kept the mobile shared header notification and dark-mode buttons on the
  bordered icon-button treatment after review, preserving the profile icon
  styling and active state.
- Changed the mobile teacher portal navigation so the footer shows Teacher
  Info, Marksheet, Messages, Routines, and More, with Announcements moved to a
  teacher-only header shortcut after the notification bell.
- Simplified mobile announcement viewer cards/details for teacher and parent
  portals by hiding registered DLT, delivery, template, version, and online/SMS
  metadata outside admin queue views, and aligned the normal announcement icon
  tone with the primary color.
- Removed the visible refresh icon buttons from the mobile Announcements and
  Messaging list headers while keeping pull-to-refresh behavior available.
- Fixed the mobile Notifications screen React warning by moving the shared
  unread-count store update out of the `setItems` state updater when marking a
  notification read.
- Applied the compact mobile workflow rule to the Student Details module by
  replacing the large student hero/tabs area with a compact overview card,
  small status pills, and a horizontal detail-section toolbar while preserving
  the existing student, parent, subject, attendance, fee, transportation, and
  marksheet logic.
- Reworked mobile messaging bubble/list text layout for foldable and narrow
  Android widths by using `useWindowDimensions` for numeric adaptive bubble
  max width and removing fixed `Text` width constraints that could clip message
  content on Galaxy Z Fold layouts.
- Replaced generic browser alert/confirm/prompt usage in the software
  Messaging page with project UI patterns: top-right `Alert` notices,
  `AlertDialog` confirmations, and a reusable shadcn input dialog for edit,
  delete mode, report, forward, moderation note, suspension reason, and member
  add flows.
