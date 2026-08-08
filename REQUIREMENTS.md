# Full-Stack LMS Requirements

## Functional Requirements

### 1. Authentication and Access Control

- Users must be able to sign in using an email address, phone number, or
  identifier and password.
- New devices, changed device types, unknown IP addresses, and suspicious
  login activity must require SMS OTP verification.
- Production password logins must require SMS OTP verification every time,
  even for previously verified devices.
- Users must be able to refresh sessions, log out, and log out from all
  sessions.
- Access must be controlled through roles and granular permissions.
- Backend routes must enforce authorization independently of frontend route
  and tab visibility.
- Supported roles include super admin, admin, teacher, parent, staff, and
  accounts users.

### 2. User, Staff, Student, and Academic Management

- Authorized administrators must be able to create and manage user accounts,
  assign roles and direct permissions, reset passwords, and activate or
  deactivate accounts.
- Staff and teacher profiles must support creation, viewing, updating,
  deletion, bulk import, academic assignments, and attendance-device mappings.
- Authorized users must be able to manage academic sessions, scopes, classes,
  sections, streams, mediums, subjects, and teacher/class/subject assignments.
- Authorized users must be able to create, view, update, delete, and bulk
  import students.
- Student records must include enrollment, academic placement, addresses,
  parent/guardian links, and documents.
- Parents must only access students linked to their accounts.
- Student-directed communication must be delivered through linked parent or
  guardian accounts.

### 3. Attendance

- Teachers and other authorized users must be able to record student
  attendance by class, section, academic session, and date.
- Teachers must only access attendance scopes assigned to them.
- Student attendance must prevent duplicate sessions for the same class,
  section, session, and date.
- Teacher submissions may require administrative approval and rejected
  attendance must be correctable and resubmittable.
- Approved absent students may trigger parent messages and notifications.
- Teacher attendance synchronization must support device/user mappings,
  shared-key external ingest, MSSQL source agents, duplicate protection, and
  teacher attendance reports.
- Attendance is not a dependency of routine substitutions; teacher absence
  does not automatically change routines.

### 4. Exams, Marks, Reports, and Exam Routines

- Authorized users must be able to create, view, update, and delete exams.
- Exams must be scoped to appropriate academic sessions and classes.
- Exams must support subject configuration and separate mark components.
- Authorized teachers must be able to save draft marks for assigned scopes and
  subjects and submit marks for approval.
- Authorized reviewers must be able to approve or reject submitted marks.
- Parents must only access approved results for linked students.
- The system must generate student reports, marksheets, mark statements, and
  supported PDF documents.
- Exam routines must be managed inside the Routine module and linked to
  existing Exam module records.
- Exam routines must support session, exam, class, section, medium, stream,
  subject, practical/custom/activity entries, exam date, start time, end time,
  optional room, and optional one or more invigilators.
- Exam routines may cover multiple classes, sections, and streams.
- Exam routine publishing may create an announcement or notification only when
  an administrator chooses that action.
- Exam routines must be visible in the Routine UI and relevant Student Details
  views and must support a school notice-style PDF.

### 5. Routines and Schedules

- Super admin and admin users must be able to manage class routines, exam
  routines, time-slot templates, and routine substitutions.
- Class routines must be scoped to academic session, class, section, medium,
  stream where applicable, weekday, and period/time slot.
- Routine period timing may be school-wide, higher-secondary-wide, or
  class/section-specific.
- Class routine entries must support entry types including subject, break,
  activity, assembly, games, library, remedial, free, and custom.
- Breaks should be supported through reusable time-slot templates where
  possible, while allowing per-class overrides.
- Subject routine entries must require subject and teacher assignment.
- Teacher assignment validation must be strict against existing academic
  assignments where applicable.
- The system must block teacher time conflicts during routine publish or
  substitution publish.
- Multiple teachers may be assigned to one routine period where needed.
- Rooms are optional.
- Saturday and other special days may have different period structures.
- Routines must support draft and published states.
- Editing a published routine must create a new draft version instead of
  mutating the published version directly.
- Publishing a new routine version must keep previous published routines
  archived.
- Published routines must support PDF download.
- Teacher views must show assigned periods, rooms, and substitution duties.
- Parent/student views must show only subject and time.
- Excel routine import is a later enhancement; imports must create draft
  routines and show unresolved class, section, subject, teacher, and conflict
  mappings before save.

### 6. Routine Substitutions

- Super admin and admin users must be able to create routine substitutions.
- Substitutions must support single dates and date ranges.
- Substitutions must have draft and published states.
- Published substitutions must apply to effective routine views immediately.
- Substitution types must include teacher substitution, subject change, extra
  class, cancelled period, free period, and room change.
- Substitutions must preserve history after the date passes.
- Cancelled periods and extra classes must be visible to parents/students.
- Substitutions must notify affected teachers, parents, and students where
  notification permissions allow.
- Substitutions must not be automatically generated from attendance records.

### 7. Fees and Payments

- Authorized users must be able to create and manage fee structures,
  installments, student ledgers, payments, approvals, receipts, and exports.
- Fee structures must support academic session, class, and stream scope.
- Parents must be able to view fees and payments for linked students.
- The system must support student-specific transportation fee management from
  Student Details and the Transportation Fee page.
- Transportation fees must be assignable per student and academic session,
  generate month-wise dues, allow one payment to cover multiple months, and
  remain separate from normal fee payments and receipts.

### 8. Messaging

- Messaging is a conversation-based module and must remain separate from the
  Announcements module.
- Only super admin users may initiate conversations.
- Authorized conversation members may participate where the conversation type
  permits replies.
- The system must support direct, class, section, and broadcast conversations.
- Broadcast conversations must be announcement-only within messaging, while
  formal announcements belong to the Announcements module.
- Messages must support text, image, document, and voice content, replies,
  forwarding, edit/delete windows, delivery/read state, search, reports, and
  moderation.
- Messaging media must remain private and require conversation-membership
  authorization.
- Existing text messages and conversations must remain readable after
  messaging upgrades.

### 9. Announcements, Holidays, and Offline SMS

- Announcements must be implemented as a separate one-way broadcast module,
  not as messaging conversations.
- Announcements must support draft, scheduled, published, sent, failed,
  cancelled, and expired lifecycle states as needed.
- Super admin and admin users must be able to create, edit, schedule, publish,
  cancel, and manage announcements.
- Announcement categories must be configurable and must support use cases such
  as general, holiday, festival, exam, exam reschedule, vacation, and urgent.
- Announcements must support delivery modes:
  - online only
  - offline SMS only
  - both online and offline SMS
- Online announcements must be visible through role-targeted software and
  mobile announcement views and may optionally be visible on the public
  website.
- Online announcements must support attachments and automatic expiry.
- Online announcements must create in-app notifications and push notifications
  after publish where permissions allow.
- Urgent online announcements must trigger push delivery where push permission
  exists.
- Read tracking is not required.
- Published announcements may be edited, but SMS-sent content must be locked.
- Cancelling a published announcement must hide it from users.
- Offline SMS announcements must use registered DLT templates through the
  existing Fast2SMS integration.
- Offline SMS must be sent only after the announcement is published and may be
  scheduled.
- DLT templates must be manageable by super admin and admin users through
  manual entry and later import.
- Offline SMS publish must validate template placeholder count and support
  `{#var#}` and `{#alp#}` placeholder styles.
- SMS preview must show the final template substitution before publish/send.
- Offline SMS draft records may be saved without a template, but publish/send
  must be blocked until a valid DLT template is selected.
- Recipients must be resolved from role, class/session/section/medium/stream,
  and individual-user targets.
- Parent SMS must be sent to all linked active parent/guardian phone numbers
  and duplicate phone numbers must be deduplicated.
- Inactive users, inactive students, and parents of inactive students must be
  excluded automatically.
- Failed SMS sends must be retryable.
- SMS delivery status should be pulled from Fast2SMS when available.
- Exact rendered SMS text does not need to be stored per recipient unless later
  required for provider/debug audit.
- Holiday and vacation announcements must create calendar-style holiday
  records.
- Holiday calendar records are display-only and must not block attendance
  entry.
- Holiday records default to school-wide but may target school, college,
  classes, sections, mediums, or streams.
- Vacation records must support date ranges.
- Holiday records must also be manually creatable outside the announcement
  flow.

### 10. Notifications

- Users must be able to retrieve, mark read, mark all read, and delete
  supported notifications.
- Web clients must receive realtime notification updates through Server-Sent
  Events where available.
- Mobile devices must support push registration where enabled.
- Domain workflows such as attendance, marksheets, fees, routines, and
  announcements may create notifications when the event is high-value.

### 11. Dashboards and Reporting

- The system must provide role-appropriate dashboard information.
- Teacher dashboards should show today's routine and substitution duties.
- Parent dashboards should show today's class routine and relevant
  announcements.
- Admin dashboards should show routine drafts and pending announcement/SMS
  work.
- Supported reports must be downloadable as PDF or exported in the appropriate
  format.

### 12. Internal Web, Public Website, and Mobile

- The internal web application must provide protected, permission-aware routes
  and operational tables, forms, filters, dialogs, dashboards, and reports.
- Routine should have its own internal software sidebar section.
- Announcements should appear under Communication in internal software.
- The public website must show only announcements explicitly marked public.
- The mobile application must provide role-aware modules and navigation.
- Mobile Routine should be a top-level tab.
- Mobile Announcements should be a top-level tab.
- Mobile Profile should live under More when Routine and Announcements become
  top-level tabs.
- Mobile authentication tokens must be stored securely and API reads must be
  cached by user scope.
- Production mobile updates must preserve the existing Android package and iOS
  bundle identifiers.

## System Requirements

### 1. Runtime and Platform

- The backend requires Node.js compatible with Express 5 and ES modules.
- MySQL must be available through `mysql2/promise`.
- npm is required for dependency installation and scripts.
- Modern browsers are required for internal and public web applications.
- Expo and EAS tooling are required for mobile development and production
  releases.
- The MSSQL attendance sync agent requires access to its configured SQL Server
  and LMS API.

### 2. Backend Architecture

- The backend must use Express 5 as the authoritative HTTP API.
- Public routes must be mounted before global authentication middleware.
- Protected routes must pass through authentication and permission attachment.
- Backend modules should separate routes, controllers, services, and
  repositories.
- Controllers must handle HTTP parsing and response formatting.
- Services must contain business rules and orchestration.
- Repositories must contain SQL and database interaction.
- SQL queries must be parameterized.
- Expected user-facing failures must use the project's structured error
  handling.
- Routine and announcement modules must follow the existing backend module
  pattern.

### 3. Database

- MySQL is the authoritative relational datastore.
- Schema and durable data changes must use versioned migrations.
- Applied migrations must not be modified; new migrations must be added.
- Production schema evolution must not depend on complete database reseeding.
- The database must store users, roles, permissions, sessions, OTP challenges,
  trusted devices, academics, people, attendance, exams, routines,
  substitutions, marks, fees, payments, messaging, announcements, DLT
  templates, holiday calendar records, notifications, audits, and sync events.

### 4. Authentication and Security

- Passwords and refresh tokens must be hashed before database storage.
- OTP values must only be stored as hashes and must not be logged.
- Token refresh must not require OTP verification.
- Backend permission checks are the security boundary.
- Frontend route and tab visibility must not be treated as authorization.
- Real secrets and environment files must not be committed.
- Uploads and announcement attachments must be validated by authorization,
  size, extension, MIME type, and file signature where applicable.

### 5. Storage

- MySQL must store records, relationships, permissions, metadata, and audit
  state.
- Student, teacher, staff, routine PDF output, announcement attachments, and
  other standard uploads may use backend-served local storage unless a module
  specifies private object storage.
- Production messaging media must use private S3-compatible object storage and
  must not use permanent public URLs.
- Media access must require authorization.

### 6. Realtime, SMS, and External Integrations

- Messaging, typing, presence, delivery, and notification updates use
  Server-Sent Events where supported.
- Core functionality must remain available through standard HTTP APIs when
  realtime connections fail.
- Fast2SMS configuration is required for production OTP and offline
  announcement SMS delivery.
- Offline announcement SMS must use approved DLT template IDs and headers.
- Expo push configuration is required only when push delivery is enabled.
- Teacher attendance synchronization must require a configured shared secret.

### 7. Background Jobs

- Messaging cleanup must start with the backend unless disabled and run daily
  at 03:30.
- Scheduled announcement publishing, SMS sending, SMS delivery-status polling,
  and announcement expiry require background job support.
- Fee-reminder and attendance sync jobs require explicit process or startup
  wiring.
- Scheduled jobs should run as a single effective instance unless distributed
  locking is added.

### 8. Validation and Operations

- Backend changes should be validated with targeted endpoint or script checks
  because no comprehensive backend test suite currently exists.
- Internal web changes should pass `npm run lint` and `npm run build` from
  `frontend/software`.
- Public website changes should pass `npm run lint` and `npm run build` from
  `frontend/website`.
- Mobile changes should pass `npm run typecheck` from `frontend/mobile`.
- Database migrations must be reviewed or applied in a suitable local
  environment before deployment.
- Authentication, authorization, payment, routine publishing, announcement
  delivery, SMS, and mobile changes should use staged testing before broad
  production rollout.
- Production releases must preserve existing data, conversations, package
  identifiers, and compatible client behavior.
